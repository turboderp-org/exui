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
from exllamav2.generator.filters import (
    ExLlamaV2SelectFilter
)

from backend.config import set_config_dir, global_state, config_filename
from backend.models import get_loaded_model
from backend.prompts import prompt_formats
from backend.util import MultiTimer
import threading

session_list: dict or None = None
current_session = None

# Cancel

abort_event = threading.Event()
def set_cancel_signal():
    global abort_event
    abort_event.set()


# List models

def list_sessions():
    global session_list

    if session_list is None:

        s_pattern = config_filename("session_*.json")
        s_files = glob.glob(s_pattern)
        s_files = sorted(s_files, key = os.path.getctime)

        session_list = {}

        for s_file in s_files:
            with open(s_file, "r") as s:
                j = json.load(s)
                i = j["session_uuid"]
                n = j["name"]
                session_list[i] = (n, s_file)

    sl = {}
    for k, v in session_list.items(): sl[k] = v[0]
    return sl, current_session.session_uuid if current_session is not None else None


# Session

def get_session():
    global current_session
    return current_session


def set_session(data):
    global current_session
    current_session = Session(data["session_uuid"])
    current_session.load()
    return current_session.to_json()


def new_session():
    global current_session, session_list
    current_session = Session()
    current_session.init_new()
    # print(f"Created session {current_session.session_uuid}")
    filename = current_session.save()
    session_list[current_session.session_uuid] = (current_session.name, filename)
    return current_session.to_json()


def delete_session(d_session):
    global current_session, session_list
    if d_session in session_list:
        filename = session_list[d_session][1]
        os.remove(filename)
        del session_list[d_session]
    if current_session is not None and current_session.session_uuid == d_session:
        current_session = None


def get_default_session_settings():
    return \
    {
        "prompt_format": "Chat-RP",
        "roles": [ "User", "Assistant", "", "", "", "", "", "" ],
        "system_prompt_default": True,
        "system_prompt": "This is a chat between a curious user and a helpful AI assistant.",
        "mintokens": 1,
        "maxtokens": 1024,
        "chunktokens": 512,
        "stop_newline": False,
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
    }

class Session:

    name: str = None
    session_uuid: str = None
    history: []
    settings: {}
    # mode: str

    history_first = 0

    def __init__(self, session_uuid = None):
        self.session_uuid = session_uuid
        self.history = []
        self.settings = {}


    def filename(self):
        return config_filename("session_" + self.session_uuid + ".json")


    def init_new(self):
        self.name = "Unnamed session"
        self.session_uuid = str(uuid.uuid4())
        self.history = []
        # self.mode = ""
        self.settings = get_default_session_settings()


    def to_json(self):
        j = {}
        j["session_uuid"] = self.session_uuid
        j["name"] = self.name
        j["history"] = self.history
        # j["mode"] = self.mode
        j["settings"] = self.settings
        return j


    def from_json(self, j):
        self.name = j["name"]
        self.session_uuid = j["session_uuid"]
        self.history = j["history"]
        # self.mode = j["mode"]
        settings = get_default_session_settings()
        if "settings" in j: settings.update(j["settings"])
        self.settings = settings


    def load(self):
        # print(f"Loading session: {self.filename()}")
        with open(self.filename(), "r") as s:
            j = json.load(s)
        self.from_json(j)


    def save(self):
        # print(f"Saving session: {self.filename()}")
        jd = json.dumps(self.to_json(), indent = 4)
        with open(self.filename(), "w") as outfile:
            outfile.write(jd)
        return self.filename()


    def update_settings(self, settings):
        self.settings = settings
        self.save()


    def _create_session_name_from_text(self, text, max_length=30):
        """Creates a session name from the first message text.
        
        Args:
            text: The message text to create name from
            max_length: Maximum length of generated name
            
        Returns:
            A name string, truncated with ellipsis if needed
        """
        if not text:
            return "Unnamed session"
        
        processed_text = text.split(": ", 1)[-1].strip()  # Cache split result
        words = processed_text.split()
        name = ""
        for word in words:
            if len(name) + len(word) + 4 <= max_length:  # +4 for "..." and space
                name += word + " "
            else:
                name = name.strip() + "..."
                break
        
        return name.strip() or "Unnamed session"

    def user_input(self, data):
        prompt_format = prompt_formats[self.settings["prompt_format"]]()
        input_text = data["user_input_text"]
        new_block = {}
        new_block["block_uuid"] = str(uuid.uuid4())
        new_block["author"] = "user"
        if prompt_format.is_instruct(): prefix = ""
        else: prefix = self.settings["roles"][0] + ": "
        new_block["text"] = prefix + input_text
        
        # Auto-rename session if this is the first message
        if len(self.history) == 0:
            self.name = self._create_session_name_from_text(input_text)
            if session_list is not None and self.session_uuid in session_list:
                session_list[self.session_uuid] = (self.name, session_list[self.session_uuid][1])
        
        self.history.append(new_block)
        self.save()
        return new_block


    def create_context(self, prompt_format, max_len, min_len, uptoblock = None, prefix = ""):

        if prompt_format.is_instruct():
            return self.create_context_instruct(prompt_format, max_len, min_len, uptoblock, prefix)
        else:
            return self.create_context_raw(prompt_format, max_len, min_len, uptoblock, prefix)


    def create_context_instruct(self, prompt_format, max_len, min_len, uptoblock = None, prefix = ""):

        tokenizer = get_loaded_model().tokenizer
        prompts = []
        responses = []

        # Make room for one-off BOS token

        if prompt_format.context_bos():
            max_len -= 1

        # Prepare prefix

        prefix_ids = None
        prefix_len = 0
        if prefix:
            prefix_ids = tokenizer.encode(prefix, encode_special_tokens = prompt_format.encode_special_tokens())
            # prefix = tokenizer.decode(prefix_ids, decode_special_tokens = prompt_format.encode_special_tokens())
            prefix_len = prefix_ids.shape[-1]

        # Create prompt-response pairs, pad in case of multiple prompts or responses in a row

        for h in self.history:

            if h["block_uuid"] == uptoblock: break

            if h["author"] == "assistant":
                if len(prompts) == len(responses): prompts.append("")
                responses.append(h["text"])

            elif h["author"] == "user":
                if len(prompts) != len(responses): responses.append("")
                prompts.append(h["text"])

            else:
                print("Unknown author")

        # Get relative length of system prompt

        p1 = prompt_format.format("", None, None, self.settings)
        p2 = prompt_format.format("", "", self.settings["system_prompt"], self.settings)
        t1 = tokenizer.encode(p1, encode_special_tokens = prompt_format.encode_special_tokens())
        t2 = tokenizer.encode(p2, encode_special_tokens = prompt_format.encode_special_tokens())
        system_length = t2.shape[-1] - t1.shape[-1]

        # Format and tokenize prompt-response pairs without system prompt

        pairs = []
        tokenized_pairs = []
        for turn in range(len(prompts)):
            p = prompts[turn]
            r = responses[turn] if turn < len(responses) else None
            pair = prompt_format.format(p, r, None, self.settings)
            pairs.append(pair)
            tokenized_pairs.append(tokenizer.encode(pair, encode_special_tokens = prompt_format.encode_special_tokens()))
        lengths = [tp.shape[-1] for tp in tokenized_pairs]

        # Advance or roll back history

        current_length = system_length + sum(lengths[self.history_first:]) + prefix_len

        if current_length > max_len:
            target_max = min_len
            while current_length > target_max and self.history_first < len(prompts) - 1:
                current_length -= lengths[self.history_first]
                self.history_first += 1

        while current_length < min_len and self.history_first > 0:
            if current_length + lengths[self.history_first - 1] > max_len: break
            self.history_first -= 1
            current_length += lengths[self.history_first]

        # Reinsert system prompt at new first position

        p = prompts[self.history_first]
        r = responses[self.history_first] if self.history_first < len(responses) else None
        pair = prompt_format.format(p, r, self.settings["system_prompt"], self.settings)
        pairs[self.history_first] = pair
        tokenized_pairs[self.history_first] = tokenizer.encode(pair, encode_special_tokens = prompt_format.encode_special_tokens())

        # Create context

        context_str = "".join(pairs[self.history_first:])
        context_ids = torch.cat(tokenized_pairs[self.history_first:], dim = -1)

        # Add prefix

        if prefix_ids is not None:
            context_str += " " + prefix
            context_ids = torch.cat([context_ids, prefix_ids], dim = -1)

        # Add context BOS

        if prompt_format.context_bos():
            context_str = tokenizer.bos_token + context_str
            context_ids = torch.cat([tokenizer.single_token(tokenizer.bos_token_id), context_ids], dim = -1)

        # print("self.history_first", self.history_first)
        # print("context_ids.shape[-1]", context_ids.shape[-1])

        return context_str, context_ids


    def create_context_raw(self, prompt_format, max_len, min_len, uptoblock = None, prefix=""):

        tokenizer = get_loaded_model().tokenizer
        history_copy = []
        for h in self.history:
            if h["block_uuid"] == uptoblock: break
            history_copy.append(h["text"] or "")

        # Get length of system prompt

        if self.settings["system_prompt"] and self.settings["system_prompt"].strip() != "":
            system_prompt = self.settings["system_prompt"] + "\n"
            system_prompt_tokenized = tokenizer.encode(system_prompt, encode_special_tokens = prompt_format.encode_special_tokens())
            system_length = system_prompt_tokenized.shape[-1]
        else:
            system_prompt = ""
            system_prompt_tokenized = torch.empty((1, 0), dtype = torch.long)
            system_length = 0

        # Format and tokenize block without system prompt

        blocks = []
        tokenized_blocks = []
        for turn in range(len(history_copy)):
            block = history_copy[turn] + "\n"
            blocks.append(block)
            tokenized_blocks.append(tokenizer.encode(block, encode_special_tokens = prompt_format.encode_special_tokens()))
        if prefix != "":
            block = prefix
            blocks.append(block)
            tokenized_blocks.append(tokenizer.encode(block, encode_special_tokens = prompt_format.encode_special_tokens()))

        lengths = [tp.shape[-1] for tp in tokenized_blocks]

        # Advance or roll back history

        current_length = system_length + sum(lengths[self.history_first:])

        if current_length > max_len:
            target_max = min_len
            while current_length > target_max and self.history_first < len(history_copy) - 1:
                current_length -= lengths[self.history_first]
                self.history_first += 1

        while current_length < min_len and self.history_first > 0:
            if current_length + lengths[self.history_first - 1] > max_len: break
            self.history_first -= 1
            current_length += lengths[self.history_first]

        # Create context

        context_str = system_prompt + "".join(blocks[self.history_first:])
        context_ids = torch.cat([system_prompt_tokenized] + tokenized_blocks[self.history_first:], dim = -1)

        # print("self.history_first", self.history_first)
        # print("context_ids.shape[-1]", context_ids.shape[-1])
        return context_str, context_ids


    def generate(self, data):
        global abort_event

        abort_event.clear()
        mt = MultiTimer()

        gen_prefix = data.get("prefix", "")
        block_id = data.get("block_id", None)

        if get_loaded_model() is None:
            packet = { "result": "fail", "error": "No model loaded." }
            yield json.dumps(packet) + "\n"
            return packet

        model = get_loaded_model().model
        generator = get_loaded_model().generator
        tokenizer = get_loaded_model().tokenizer
        cache = get_loaded_model().cache
        speculative_mode = get_loaded_model().speculative_mode

        prompt_format = prompt_formats[self.settings["prompt_format"]]()

        # Create response block

        new_block = None

        if block_id is not None:

            for b in self.history:
                if b["block_uuid"] == block_id:
                    new_block = b
                    break
            new_block["text"] = ""

        elif prompt_format.is_instruct():

            new_block = {}
            new_block["block_uuid"] = str(uuid.uuid4())
            new_block["author"] = "assistant"
            new_block["text"] = ""

            packet = {}
            packet["result"] = "begin_block"
            packet["block"] = new_block
            yield json.dumps(packet) + "\n"

        # Sampling settings

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

        if gen_settings.temperature == 0:
            gen_settings.temperature = 1.0
            gen_settings.top_k = 1
            gen_settings.top_p = 0
            gen_settings.typical = 0

        if prompt_format.is_instruct():
            generator.set_stop_conditions(prompt_format.stop_conditions(tokenizer, self.settings))
        else:
            if self.settings["stop_newline"]:
                generator.set_stop_conditions(["\n"])
            else:
                stop = set()
                for r in self.settings["roles"]:
                    if r.strip() != "":
                        stop.add("\n" + r + ":")
                        stop.add("\n " + r + ":")
                        stop.add("\n" + r.upper() + ":")
                        stop.add("\n " + r.upper() + ":")
                        stop.add("\n" + r.lower() + ":")
                        stop.add("\n " + r.lower() + ":")
                generator.set_stop_conditions(list(stop) + [tokenizer.eos_token_id])

        if speculative_mode == "N-gram":
            generator.speculative_ngram = True

        banned_strings = self.settings.get("banned_strings", "").strip()
        banned_strings = banned_strings.split("\n")
        banned_strings = [bs.strip() for bs in banned_strings if bs.strip()]
        if len(banned_strings) == 0: banned_strings = None

        if prompt_format.is_instruct():
            min_tokens = self.settings.get("mintokens", None)
            eos_tokens = prompt_format.stop_conditions(tokenizer, self.settings)
            eos_tokens = [sc for sc in eos_tokens if isinstance(sc, int)]
            if len(eos_tokens) == 0: eos_tokens = None
        else:
            eos_tokens = None
            min_tokens = None

        # Begin response

        generated_tokens = 0
        max_new_tokens = self.settings["maxtokens"]
        chunk_tokens = 0

        last_chunk_time = time.time()
        full_response = ""  # gen_prefix
        save_tokens = torch.empty((1, 0), dtype = torch.long)
        chunk_buffer = ""

        chunk_size = self.settings["chunktokens"]

        # If not in instruct mode, generate bot name prefix

        healing = False
        if not prompt_format.is_instruct():

            prefix = ""
            bot_roles = []
            for r in self.settings["roles"][1:]:
                if r.strip() != "": bot_roles.append(r + ":")
            assert len(bot_roles) >= 1

            # Get bot role from prefix

            skip_select = False
            p_healing = False
            if gen_prefix:
                skip_select = True
                nbr = []
                for br in bot_roles:
                    if len(gen_prefix) < len(br) and br.startswith(gen_prefix):
                        nbr.append(br[len(gen_prefix):])
                if len(nbr) >= 1:
                    bot_roles = nbr
                    skip_select = False
                    p_healing = True
                    prefix = gen_prefix

            # Generate bot role

            if not skip_select:

                past_tokens = model.config.max_seq_len - chunk_size - save_tokens.shape[-1]
                past_tokens_min = model.config.max_seq_len - 2 * chunk_size - save_tokens.shape[-1]
                context_str, context_ids = self.create_context(prompt_format, past_tokens, past_tokens_min, uptoblock = block_id)
                sfilter = ExLlamaV2SelectFilter(model, tokenizer, bot_roles, case_insensitive = False)
                gen_settings.filters = [sfilter]

                mt.set_stage("prompt")
                generator.begin_stream_ex(
                    input_ids = context_ids,
                    gen_settings = gen_settings,
                    token_healing = p_healing,
                    abort_event = abort_event,
                    banned_strings = banned_strings,
                    filters = gen_settings.filters,
                    filter_prefer_eos = gen_settings.filters
                )
                if abort_event.is_set():
                    abort_event.clear()
                    packet = { "result": "cancel_pre" }
                    yield json.dumps(packet) + "\n"
                    return packet

                mt.stop()

                mt.set_stage("gen")
                while True:
                    chunk, eos, tokens = generator.stream()
                    prefix += chunk
                    if eos: break
                mt.stop()

                gen_settings.filters = []
                gen_prefix = prefix

            else:

                prefix = gen_prefix
                healing = True

            # Begin block with bot name prefix

            if not new_block:

                new_block = {}
                new_block["block_uuid"] = str(uuid.uuid4())
                new_block["author"] = "assistant"
                new_block["text"] = prefix

                packet = {}
                packet["result"] = "begin_block"
                packet["block"] = new_block
                yield json.dumps(packet) + "\n"

            else:

                new_block["text"] = prefix

        else:

            prefix = gen_prefix
            if gen_prefix: healing = True

        # Stream response

        mt.set_stage("gen")
        while True:

            if chunk_tokens == 0:

                packet = {}
                packet["result"] = "prompt_eval"
                packet["block_uuid"] = new_block["block_uuid"]
                yield json.dumps(packet) + "\n"

                past_tokens = model.config.max_seq_len - chunk_size - save_tokens.shape[-1]
                past_tokens_min = model.config.max_seq_len - 2 * chunk_size - save_tokens.shape[-1]
                context_str, context_ids = self.create_context(prompt_format, past_tokens, past_tokens_min, prefix = prefix, uptoblock = block_id)
                context_ids = torch.cat((context_ids, save_tokens), dim = -1)

                mt.set_stage("prompt")
                generator.begin_stream_ex(
                    input_ids = context_ids,
                    gen_settings = gen_settings,
                    token_healing = healing,
                    abort_event = abort_event,
                    banned_strings = banned_strings
                )
                if abort_event.is_set():
                    break

                prefix = ""
                healing = False
                chunk_tokens = model.config.max_seq_len - context_ids.shape[-1] - 1
                mt.set_stage("gen")

            temp_ban_tokens = None
            if min_tokens is not None and generated_tokens < min_tokens:
                temp_ban_tokens = eos_tokens

            res = generator.stream_ex(
                ban_tokens = temp_ban_tokens
            )
            if abort_event.is_set(): break

            save_tokens = torch.cat((save_tokens, res["chunk_token_ids"]), dim = -1)

            generated_tokens += 1
            chunk_tokens -= 1

            chunk_buffer += res["chunk"]

            now = time.time()
            elapsed = now - last_chunk_time

            if chunk_buffer != "" and (elapsed > 0.05 or res["eos"] or generated_tokens == max_new_tokens):

                packet = {}
                packet["result"] = "stream_to_block"
                packet["block_uuid"] = new_block["block_uuid"]
                packet["text"] = chunk_buffer
                yield json.dumps(packet) + "\n"

                full_response += chunk_buffer
                chunk_buffer = ""
                last_chunk_time = now

            if res["eos"] or generated_tokens == max_new_tokens: break

        # Compile metadata

        mt.stop()
        meta = {}
        meta["prompt_tokens"] = context_ids.shape[-1]
        meta["prompt_speed"] = context_ids.shape[-1] / (mt.stages["prompt"] + 1e-8)
        meta["gen_tokens"] = generated_tokens
        meta["gen_speed"] = generated_tokens / (mt.stages["gen"] + 1e-8)
        meta["overflow"] = max_new_tokens if generated_tokens == max_new_tokens else 0
        meta["canceled"] = abort_event.is_set()
        meta["context_tokens"] = context_ids.shape[-1] + save_tokens.shape[-1]  # Total tokens in context
        meta["max_seq_len"] = model.config.max_seq_len  # Maximum sequence length
        new_block["meta"] = meta

        # Save response block

        if gen_prefix:
            new_block["text"] = gen_prefix + prefix + full_response.rstrip()
        else:
            new_block["text"] = prefix + full_response.rstrip()
        if not block_id:
            self.history.append(new_block)
        self.save()

        # Done

        packet = { "result": "ok", "new_block": new_block }
        yield json.dumps(packet) + "\n"

        return packet


    def rename(self, data):
        global session_list

        if "session_uuid" in data:
            assert data["session_uuid"] == self.session_uuid

        session_list[self.session_uuid] = (data["new_name"], session_list[self.session_uuid][1])
        self.name = data["new_name"]
        self.save()


    def delete_block(self, block_uuid, delete_from_here):

        # print(f"Deleting block: {block_uuid}")

        if delete_from_here:
            deleting = False
            todelete = []
            for h in self.history:
                if h["block_uuid"] == block_uuid or deleting:
                    todelete.append(h)
                    deleting = True
            for h in todelete:
                self.history.remove(h)
        else:
            for h in self.history:
                if h["block_uuid"] == block_uuid:
                    self.history.remove(h)
        self.save()


    def edit_block(self, block):

        block_uuid = block['block_uuid']
        # print(f"Editing block: {block_uuid}")

        for i in range(len(self.history)):
            if self.history[i]["block_uuid"] == block_uuid:
                self.history[i] = block
                break
        self.save()
