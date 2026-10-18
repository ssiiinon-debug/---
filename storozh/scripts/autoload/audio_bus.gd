# Звуки и фоновая музыка.
# Короткие 3D-звуки создаются «одноразовыми» плеерами внутри текущего уровня,
# фоновый гул и музыка погони живут здесь и плавно переключаются.
extends Node

const AUDIO_DIR := "res://assets/audio/"
## Слой physics «audio»: на нём лежат зоны эха (Area3D с reverb_bus_enabled).
const AUDIO_ZONES_LAYER := 1 << 5

## Куда добавлять 3D-звуки. Уровень сам регистрирует сюда свой корень:
## он лежит внутри SubViewport, и звук должен быть в том же 3D-мире, что и камера.
var world_root: Node3D

var _cache: Dictionary = {}
var _ambience: AudioStreamPlayer
var _chase: AudioStreamPlayer
var _chase_target_db := -80.0
var _ambience_target_db := -80.0

const CHASE_DB := -6.0
const SILENT_DB := -80.0


func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS
	_ambience = _make_music_player()
	_chase = _make_music_player()


func _exit_tree() -> void:
	# Иначе при выходе движок ругается на «утёкший» играющий поток.
	for p: AudioStreamPlayer in [_ambience, _chase]:
		p.stop()
		p.stream = null
	_cache.clear()


func _make_music_player() -> AudioStreamPlayer:
	var p := AudioStreamPlayer.new()
	p.bus = &"Ambience"
	p.volume_db = SILENT_DB
	add_child(p)
	return p


func _process(delta: float) -> void:
	_chase.volume_db = move_toward(_chase.volume_db, _chase_target_db, 40.0 * delta)
	_ambience.volume_db = move_toward(_ambience.volume_db, _ambience_target_db, 25.0 * delta)
	if _chase.playing and _chase.volume_db <= SILENT_DB + 1.0 and _chase_target_db <= SILENT_DB:
		_chase.stop()


## Загрузить звук по имени файла без расширения. OGG важнее WAV:
## положишь рядом storozh_laugh.ogg — игра возьмёт его вместо заглушки.
func get_stream(sound_name: String) -> AudioStream:
	if _cache.has(sound_name):
		return _cache[sound_name]
	var stream: AudioStream = null
	for ext: String in [".ogg", ".wav"]:
		var path := AUDIO_DIR + sound_name + ext
		if ResourceLoader.exists(path):
			stream = load(path)
			break
	if stream == null:
		push_warning("Нет звука: " + sound_name)
	_cache[sound_name] = stream
	return stream


## Случайный звук из серии: pick("step_wood", 4) -> step_wood_1..4
func pick(prefix: String, count: int) -> AudioStream:
	return get_stream("%s_%d" % [prefix, randi_range(1, count)])


func play_3d(stream: AudioStream, position: Vector3, volume_db := 0.0,
		max_distance := 30.0, pitch_jitter := 0.08) -> AudioStreamPlayer3D:
	if stream == null or world_root == null or not is_instance_valid(world_root):
		return null
	var p := AudioStreamPlayer3D.new()
	p.stream = stream
	p.bus = &"SFX"
	p.volume_db = volume_db
	p.max_distance = max_distance
	p.unit_size = 3.0
	p.pitch_scale = randf_range(1.0 - pitch_jitter, 1.0 + pitch_jitter)
	p.area_mask = AUDIO_ZONES_LAYER
	world_root.add_child(p)
	p.global_position = position
	p.finished.connect(p.queue_free)
	p.play()
	return p


func play_ui(stream: AudioStream, volume_db := 0.0) -> void:
	if stream == null:
		return
	var p := AudioStreamPlayer.new()
	p.stream = stream
	p.bus = &"SFX"
	p.volume_db = volume_db
	add_child(p)
	p.finished.connect(p.queue_free)
	p.play()


func set_ambience(sound_name: String, volume_db := -10.0) -> void:
	var stream := get_stream(sound_name)
	if stream == null:
		return
	_make_looping(stream)
	if _ambience.stream != stream:
		_ambience.stream = stream
		_ambience.play()
	_ambience_target_db = volume_db


func set_chase(active: bool) -> void:
	if active:
		if not _chase.playing:
			var stream := get_stream("chase_loop")
			_make_looping(stream)
			_chase.stream = stream
			_chase.play()
		_chase_target_db = CHASE_DB
	else:
		_chase_target_db = SILENT_DB


func stop_all() -> void:
	_chase_target_db = SILENT_DB
	_ambience_target_db = SILENT_DB


func _make_looping(stream: AudioStream) -> void:
	if stream is AudioStreamWAV:
		var wav := stream as AudioStreamWAV
		if wav.loop_mode == AudioStreamWAV.LOOP_DISABLED:
			wav.loop_mode = AudioStreamWAV.LOOP_FORWARD
			wav.loop_begin = 0
			wav.loop_end = int(wav.get_length() * wav.mix_rate)
	elif stream is AudioStreamOggVorbis:
		(stream as AudioStreamOggVorbis).loop = true
