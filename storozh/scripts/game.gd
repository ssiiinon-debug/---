# Одна ночь целиком: уровень внутри пиксельного SubViewport, HUD, пауза,
# сценарий начала ночи, рассвет, контрольные точки, смерть и победа.
extends Node

const MENU_SCENE := "res://scenes/main_menu.tscn"

@export var level_scene: PackedScene
## Длина ночи в реальных секундах. В диздоке глава 4 — 15–20 минут, для среза короче.
@export var night_duration := 420.0
## Часов в ночи: с каждым часом Сторож слышит дальше и ходит быстрее.
@export var night_hours := 5
## Через сколько секунд Сторож выбирается из подпола.
@export var wake_delay := 28.0
## На каких часах сохраняется контрольная точка.
@export var checkpoint_hours: Array[int] = [2, 4]

@onready var world_container: SubViewportContainer = $World
@onready var world_viewport: SubViewport = $World/SubViewport
@onready var hud: Hud = $HUD
@onready var pause_menu: PauseMenu = $PauseMenu
@onready var end_screen: EndScreen = $EndScreen

var level: NightLevel
var player: Player
var storozh: Storozh
var night_time := 0.0
var hour := 0
var running := false

var _post: ShaderMaterial
var _flash := 0.0
## Сценарий начала ночи: [секунда, действие], по порядку.
var _script_events: Array = []
var _birds_started := false


func _ready() -> void:
	get_tree().paused = false
	_post = world_container.material as ShaderMaterial
	level = level_scene.instantiate() as NightLevel
	world_viewport.add_child(level)
	player = level.player
	storozh = level.storozh
	AudioBus.world_root = level

	player.caught.connect(_on_player_caught)
	player.flash_fired.connect(func() -> void: _flash = 1.0)
	player.message.connect(hud.show_message)
	pause_menu.restart_requested.connect(_restart_night)
	pause_menu.menu_requested.connect(_to_menu)
	end_screen.retry_requested.connect(_retry)
	end_screen.menu_requested.connect(_to_menu)
	GameState.settings_changed.connect(_apply_settings)
	_apply_settings()

	Input.mouse_mode = Input.MOUSE_MODE_CAPTURED
	_start_night()


func _apply_settings() -> void:
	world_container.stretch_shrink = GameState.pixel_scale


func _start_night() -> void:
	var cp := GameState.checkpoint
	if cp.is_empty():
		_script_events = [
			[1.0, func() -> void: hud.show_hint("Глава 4. Ночь", 4.0)],
			[3.0, level.knock],
			[5.5, func() -> void: hud.show_hint("Друзей нигде нет. Из подпола кто-то стучит.", 5.0)],
			[11.0, level.knock],
			[12.5, func() -> void: hud.show_hint("Дожить до рассвета. Шум и свет привлекают его.", 6.0)],
			[19.0, level.knock],
			[20.0, func() -> void: hud.show_hint(
				"[F] фонарик · [Ctrl] присесть · [E] спрятаться · [Пробел] в укрытии — не дышать", 7.0)],
			[wake_delay, _wake_storozh],
			[wake_delay + 4.0, func() -> void: hud.show_hint(
				"[ЛКМ] вспышка камеры ослепляет его на пару секунд. Зарядов мало.", 6.0)],
		]
	else:
		night_time = float(cp.get("night_time", 0.0))
		player.battery = float(cp.get("battery", 1.0))
		player.flash_charges = int(cp.get("flash_charges", player.flash_charges))
		level.place_storozh_away_from_player()
		storozh.wake()
		hud.show_hint("Ночь продолжается.", 3.0)
	hour = _hour_at(night_time)
	storozh.hour = hour
	level.set_dawn(night_time / night_duration)
	AudioBus.set_ambience("drone_loop", -12.0)
	running = true


func _wake_storozh() -> void:
	storozh.wake()
	level.laugh_from_basement()


func _hour_at(time: float) -> int:
	return mini(int(time / night_duration * night_hours), night_hours - 1)


func _process(delta: float) -> void:
	_flash = move_toward(_flash, 0.0, delta * 3.0)
	_post.set_shader_parameter("flash", _flash)
	_post.set_shader_parameter("fear", player.fear)
	hud.update_from(player, storozh, "час %d · %d из %d сек" % [hour, int(night_time), int(night_duration)])
	if not running:
		return

	night_time += delta
	while not _script_events.is_empty() and night_time >= _script_events[0][0]:
		var event: Array = _script_events.pop_front()
		(event[1] as Callable).call()

	var t := night_time / night_duration
	level.set_dawn(t)
	var h := _hour_at(night_time)
	if h != hour:
		hour = h
		storozh.hour = h
		if h in checkpoint_hours:
			_save_checkpoint()
	if t > 0.93 and not _birds_started:
		_birds_started = true
		level.start_birds()
	if t >= 1.0:
		_win()


func _input(event: InputEvent) -> void:
	if event is InputEventMouseMotion and Input.mouse_mode == Input.MOUSE_MODE_CAPTURED:
		player.look_mouse((event as InputEventMouseMotion).screen_relative)
	elif OS.is_debug_build() and event.is_action_pressed("debug_skip_hour") and running:
		# Отладка: F5 проматывает час, F3 — оверлей с состоянием Сторожа.
		night_time = minf(night_time + night_duration / night_hours, night_duration - 1.0)
	elif OS.is_debug_build() and event.is_action_pressed("debug_overlay"):
		hud.toggle_debug()


func _save_checkpoint() -> void:
	# Посреди погони не сохраняемся: возвращать игрока прямо в лапы нечестно.
	if player.dead or storozh.state == Storozh.State.CHASE:
		return
	var picked: Array = GameState.checkpoint.get("picked", []).duplicate()
	picked.append_array(player.picked_ids)
	GameState.save_checkpoint({
		"night_time": night_time,
		"battery": player.battery,
		"flash_charges": player.flash_charges,
		"picked": picked,
	})
	hud.show_checkpoint()


func _on_player_caught(by: Storozh, reason: StringName) -> void:
	running = false
	pause_menu.can_pause = false
	AudioBus.stop_all()
	await get_tree().create_timer(1.2).timeout
	await hud.fade_to(Color.BLACK, 0.5).finished
	end_screen.show_death(reason, by.alert_source, GameState.has_checkpoint())


func _win() -> void:
	running = false
	pause_menu.can_pause = false
	player.controls_enabled = false
	storozh.retreat()
	GameState.clear_checkpoint()
	await get_tree().create_timer(3.0).timeout
	await hud.fade_to(Color(0.85, 0.86, 0.88), 2.0).finished
	end_screen.show_victory({
		"spotted": storozh.times_spotted,
		"flashes": player.flashes_used,
		"hidden": player.time_hidden,
	})


func _retry() -> void:
	get_tree().reload_current_scene()


func _restart_night() -> void:
	GameState.clear_checkpoint()
	get_tree().reload_current_scene()


func _to_menu() -> void:
	AudioBus.stop_all()
	get_tree().change_scene_to_file(MENU_SCENE)
