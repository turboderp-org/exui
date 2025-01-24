import json, uuid, os, gc, glob, time
import torch

from exllamav2 import (
    ExLlamaV2,
    ExLlamaV2Config,
    ExLlamaV2Cache,
    ExLlamaV2Cache_8bit,
    ExLlamaV2Tokenizer,
)
from exllamav2.generator import (
    ExLlamaV2StreamingGenerator,
    ExLlamaV2Sampler
)

from backend.config import set_config_dir, global_state, config_filename
from backend.models import get_loaded_model
from backend.prompts import prompt_formats
from backend.util import MultiTimer
import threading

notepad_list: dict or None = None
current_notepad = None

# Cancel

abort_event = threading.Event()
def set_notepad_cancel_signal():
    global abort_event
    abort_event.set()


def list_notepads():
    global notepad_list

    if notepad_list is None:

        s_pattern = config_filename("notepad_*.json")
        s_files = glob.glob(s_pattern)
        s_files = sorted(s_files, key = os.path.getctime)

        notepad_list = {}

        for s_file in s_files:
            with open(s_file, "r") as s:
                j = json.load(s)
                i = j["notepad_uuid"]
                n = j["name"]
                notepad_list[i] = (n, s_file)

    sl = {}
    for k, v in notepad_list.items(): sl[k] = v[0]
    return sl, current_notepad.notepad_uuid if current_notepad is not None else None


# Notepad

def get_notepad():
    global current_notepad
    return current_notepad


def set_notepad(data):
    global current_notepad
    current_notepad = Notepad(data["notepad_uuid"])
    current_notepad.load()
    result = { "notepad": current_notepad.to_json() }
    if get_loaded_model():
        result["tokenized_text"] = current_notepad.get_tokenized_text()
    return result


def new_notepad():
    global current_notepad, notepad_list
    current_notepad = Notepad()
    current_notepad.init_new()
    # print(f"Created notepad {current_notepad.notepad_uuid}")
    filename = current_notepad.save()
    notepad_list[current_notepad.notepad_uuid] = (current_notepad.name, filename)
    return current_notepad.to_json()


def delete_notepad(d_notepad):
    global current_notepad, notepad_list
    if d_notepad in notepad_list:
        filename = notepad_list[d_notepad][1]
        os.remove(filename)
        del notepad_list[d_notepad]
    if current_notepad is not None and current_notepad.notepad_uuid == d_notepad:
        current_notepad = None


def get_default_notepad_settings():
    return \
    {
        "maxtokens": 256,
        "chunktokens": 64,
        "temperature": 0.8,
        "top_k": 50,
        "top_p": 0.8,
        "min_p": 0.0,
        "tfs": 0.0,
        "mirostat": False,
        "mirostat_tau": 1.25,
        "mirostat_eta": 0.1,
        "typical": 0.0,
        "repp": 1.01,
        "repr": 1024,
        "repd": 512,
        "quad_sampling": 0.0,
        "temperature_last": False,
        "skew": 0.0,
        "stop_conditions": [ { "text": "</s>", "inclusive": False } ],
        "dry_base": 1.75,
        "dry_multiplier": 0.0,
        "dry_range": 1024
    }


class Notepad:

    name: str = None
    notepad_uuid: str = None
    text = ""
    settings: {} = None

    context_head = 0

    def __init__(self, notepad_uuid = None):
        self.notepad_uuid = notepad_uuid
        self.context_head = 0


    def filename(self):
        return config_filename("notepad_" + self.notepad_uuid + ".json")


    def init_new(self):
        self.name = "Unnamed notepad"
        self.notepad_uuid = str(uuid.uuid4())
        self.text = "Once upon a time,"
        self.settings = get_default_notepad_settings()


    def to_json(self):
        j = {}
        j["notepad_uuid"] = self.notepad_uuid
        j["name"] = self.name
        j["text"] = self.text
        j["settings"] = self.settings
        return j


    def from_json(self, j):
        self.name = j["name"]
        self.notepad_uuid = j["notepad_uuid"]
        self.text = j["text"]
        settings = get_default_notepad_settings()
        if "settings" in j: settings.update(j["settings"])
        self.settings = settings


    def rename(self, data):
        global notepad_list

        if "notepad_uuid" in data:
            assert data["notepad_uuid"] == self.notepad_uuid

        notepad_list[self.notepad_uuid] = (data["new_name"], notepad_list[self.notepad_uuid][1])
        self.name = data["new_name"]
        self.save()


    def save(self):
        # print(f"Saving notepad: {self.filename()}")
        jd = json.dumps(self.to_json(), indent = 4)
        with open(self.filename(), "w") as outfile:
            outfile.write(jd)
        return self.filename()


    def load(self):
        # print(f"Loading notepad: {self.filename()}")
        with open(self.filename(), "r") as s:
            j = json.load(s)
        self.from_json(j)


    def update_settings(self, settings):
        self.settings = settings
        self.save()


    def set_text(self, text):
        self.text = text
        self.save()


    def get_tokenized_text(self):
        m = get_loaded_model()
        if not m: return None
        tokens = m.tokenizer.encode(self.text, encode_special_tokens = True)[0].tolist()
        id_to_piece = m.tokenizer.get_id_to_piece_list()
        tokenized = []
        for token in tokens:
            t = {}
            t["id"] = token
            ext_piece = m.tokenizer.extended_id_to_piece.get(token)
            t["piece"] = ext_piece if ext_piece else id_to_piece[token]
            tokenized.append(t)
        return tokenized


    def get_gen_settings(self):

        gen_settings = ExLlamaV2Sampler.Settings()
        gen_settings.temperature = self.settings["temperature"]
        gen_settings.temperature_last = self.settings["temperature_last"]
        gen_settings.top_k = self.settings["top_k"]
        gen_settings.top_p = self.settings["top_p"]
        gen_settings.min_p = self.settings["min_p"]
        gen_settings.smoothing_factor = self.settings["quad_sampling"]
        gen_settings.tfs = self.settings["tfs"]
        gen_settings.typical = self.settings["typical"]
        gen_settings.mirostat = self.settings["mirostat"]
        gen_settings.mirostat_tau = self.settings["mirostat_tau"]
        gen_settings.mirostat_eta = self.settings["mirostat_eta"]
        gen_settings.skew = self.settings["skew"]
        gen_settings.token_repetition_penalty = self.settings["repp"]
        gen_settings.token_repetition_range = self.settings["repr"]
        gen_settings.token_repetition_decay = self.settings["repr"]

        gen_settings.dry_base = self.settings["dry_base"]
        gen_settings.dry_multiplier = self.settings["dry_multiplier"]
        gen_settings.dry_range = self.settings["dry_range"]
        

        if gen_settings.temperature == 0:
            gen_settings.temperature = 1.0
            gen_settings.top_k = 1
            gen_settings.top_p = 0
            gen_settings.typical = 0

        return gen_settings


    def generate_single_token(self, data):
        global abort_event

        if get_loaded_model() is None:
            packet = { "result": "fail", "error": "No model loaded." }
            return packet

        model = get_loaded_model().model
        generator = get_loaded_model().generator
        tokenizer = get_loaded_model().tokenizer
        cache = get_loaded_model().cache

        # Sampling settings

        gen_settings = self.get_gen_settings()

        # Context

        context_str = data["context"]
        context_post_str = data["context_post"]
        context_ids = tokenizer.encode(context_str, encode_special_tokens = True)

        # Truncate past

        head_ideal = context_ids.shape[-1] - model.config.max_seq_len

        chunk_size = self.settings["chunktokens"]
        while head_ideal < self.context_head - chunk_size:
            self.context_head -= chunk_size
        if head_ideal > self.context_head: self.context_head = head_ideal + chunk_size - 1
        if self.context_head < 0: self.context_head = 0

        context_ids = context_ids[:, self.context_head:]
        # print(head_ideal, self.context_head)

        # Generate

        generator.begin_stream_ex(context_ids, gen_settings, token_healing = True, abort_event = abort_event)
        generator.set_stop_conditions([])

        # Get one token (or at least one UTF-8 character)

        chunk = ""
        while True:
            chunk_, eos, tokens = generator.stream()
            chunk += chunk_
            if tokens.shape[-1] != 0 or eos: break

        for i in range(tokens.shape[-1]):
            t = tokens[0, i].item()
            if t in tokenizer.extended_id_to_piece: chunk += tokenizer.extended_id_to_piece[t]

        self.text = context_str + chunk + context_post_str

        # Save

        self.save()

        # Response

        packet = {}
        packet["result"] = "ok"
        packet["text"] = chunk
        packet["tokenized_text"] = self.get_tokenized_text()
        return packet


    def generate(self, data):
        global abort_event

        if get_loaded_model() is None:
            packet = { "result": "fail", "error": "No model loaded." }
            return packet

        model = get_loaded_model().model
        generator = get_loaded_model().generator
        tokenizer = get_loaded_model().tokenizer
        cache = get_loaded_model().cache

        # Sampling settings

        gen_settings = self.get_gen_settings()

        banned_strings = self.settings.get("banned_strings", "").strip()
        banned_strings = banned_strings.split("\n")
        banned_strings = [bs.strip() for bs in banned_strings if bs.strip()]
        if len(banned_strings) == 0: banned_strings = None

        # Context

        context_str = data["context"]
        context_post_str = data["context_post"]
        full_context_ids = tokenizer.encode(context_str, encode_special_tokens = True)
        build_str = ""

        # Stop conditions

        exclusive_sc = []
        inclusive_sc = []
        for stop_condition in self.settings["stop_conditions"]:
            text = stop_condition["text"].encode().decode('unicode_escape')
            inclusive = stop_condition["inclusive"]
            if inclusive:
                inclusive_sc.append(text)
            else:
                if stop_condition["text"] in tokenizer.extended_piece_to_id:
                    exclusive_sc.append(tokenizer.extended_piece_to_id[text])
                else:
                    exclusive_sc.append(text)

        # Truncate past

        head_ideal = full_context_ids.shape[-1] - model.config.max_seq_len
        chunk_size = self.settings["chunktokens"]
        while head_ideal < self.context_head - chunk_size:
            self.context_head -= chunk_size

        # Generator loop

        abort_event.clear()

        total_tokens = 0
        max_tokens = self.settings["maxtokens"]
        prev_head = -1
        token_healing = True
        while True:

            if abort_event.is_set(): break

            # Adjust context

            head_ideal = full_context_ids.shape[-1] - model.config.max_seq_len
            if head_ideal > self.context_head: self.context_head = head_ideal + chunk_size - 1
            if self.context_head < 0: self.context_head = 0

            # Begin stream

            if self.context_head != prev_head:
                prev_head = self.context_head
                context_ids = full_context_ids[:, self.context_head:]
                generator.begin_stream_ex(context_ids, gen_settings, token_healing = token_healing, abort_event = abort_event, banned_strings = banned_strings)
                if abort_event.is_set():
                    abort_event.clear()
                    packet = {}
                    packet["result"] = "cancel"
                    yield json.dumps(packet) + "\n"
                    return packet

                generator.set_stop_conditions(exclusive_sc)
                token_healing = False

            # Get single token

            chunk, eos, tokens = generator.stream()
            for i in range(tokens.shape[-1]):
                t = tokens[0, i].item()
                if t in tokenizer.extended_id_to_piece: chunk += tokenizer.extended_id_to_piece[t]
            build_str += chunk
            self.text = context_str + build_str + context_post_str
            full_context_ids = torch.cat((full_context_ids, tokens), dim = -1)

            # Stop conditions

            total_tokens += 1
            if total_tokens >= max_tokens: eos = True
            else:
                for s in inclusive_sc:
                    if s in build_str:
                        extra_chars = len(build_str) - (build_str.find(s) + len(s))
                        if extra_chars > 0:
                            chunk = chunk[:-extra_chars]
                            build_str = build_str[:-extra_chars]
                        eos = True
                        break

            # Stream

            if chunk != "":
                packet = {}
                packet["result"] = "stream_chunk"
                packet["text"] = chunk
                yield json.dumps(packet) + "\n"

            if eos: break

        # Save

        self.save()

        # Response

        packet = {}
        if abort_event.is_set():
            abort_event.clear()
            packet["result"] = "cancel"
        else:
            packet["result"] = "ok"
        packet["tokenized_text"] = self.get_tokenized_text()
        yield json.dumps(packet) + "\n"

        packet = {}
        packet["result"] = "ok"
        return packet





