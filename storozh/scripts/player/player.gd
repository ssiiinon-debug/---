# Игрок (Саня): ходьба, бег, присед, фонарик, камера Кости со вспышкой,
# укрытия и задержка дыхания. Игрок не сражается: его оружие — свет, слух и тишина.
#
# Мышь сюда приходит из game.gd через look(): 3D-мир живёт внутри SubViewport,
# и так надёжнее, чем ловить события мыши через контейнер.
class_name Player
extends CharacterBody3D

signal caught(storozh: Node3D, reason: StringName)
signal flash_fired
signal message(text: String)
signal hidden_changed(is_hidden: bool)

const LAYER_WORLD := 1
const LAYER_DOOR := 1 << 4
const PITCH_LIMIT := deg_to_rad(85.0)

@export_group("Движение")
@export var walk_speed := 2.6
@export var sprint_speed := 4.8
@export var crouch_speed := 1.3
@export var acceleration := 10.0
@export var stand_height := 1.75
@export var crouch_height := 1.05
## Насколько глаза ниже макушки.
@export var eye_offset := 0.12
## Сколько секунд можно бежать без остановки.
@export var stamina_max := 6.0
@export var stamina_regen := 1.0
@export var stamina_regen_delay := 1.0

@export_group("Шум (радиус в метрах)")
@export var noise_walk := 3.0
@export var noise_run := 14.0
@export var noise_crouch := 0.8
@export var noise_creak := 9.0
@export var noise_creak_run := 14.0
@export var noise_flashlight_click := 2.5
@export var noise_panting := 4.0

@export_group("Фонарик")
## На сколько секунд света хватает полной батарейки.
@export var battery_seconds := 240.0
@export var battery_per_pickup := 0.6
@export var flashlight_energy := 3.5

@export_group("Камера Кости")
@export var flash_charges := 2
@export var flash_range := 10.0
@export var flash_angle := 35.0
@export var flash_blind_time := 2.5
@export var flash_cooldown := 1.2
@export var noise_flash := 6.0

@export_group("Дыхание")
## Сколько секунд можно не дышать.
@export var breath_hold_max := 7.0
@export var breath_regen := 1.2
## На сколько метров слышно обычное дыхание в укрытии.
@export var breath_noise_radius := 2.6
@export var breath_noise_interval := 1.0
@export var noise_gasp := 9.0
## После судорожного вдоха какое-то время задержать дыхание не получится.
@export var gasp_lock_time := 3.0

@export_group("Обзор")
## Радиан на пиксель мыши при чувствительности 1.0 в настройках.
@export var mouse_radians_per_pixel := 0.0022
@export var gamepad_look_speed := 2.6
@export var fov_normal := 72.0
@export var fov_aim := 48.0

@onready var head: Node3D = $Head
@onready var camera: Camera3D = $Head/Camera3D
@onready var flashlight: SpotLight3D = $Head/Camera3D/Flashlight
@onready var flash_burst: OmniLight3D = $Head/Camera3D/FlashBurst
@onready var interact_ray: RayCast3D = $Head/Camera3D/InteractRay
@onready var collision_shape: CollisionShape3D = $CollisionShape3D
@onready var footsteps: AudioStreamPlayer3D = $Footsteps
@onready var breath_player: AudioStreamPlayer = $Breath
@onready var heart_player: AudioStreamPlayer = $Heartbeat

# --- Состояние (его читают HUD, Сторож и контрольные точки) ---
var battery := 1.0
var light_on := false
var stamina := 0.0
var breath := 0.0
var crouching := false
var sprinting := false
var aiming := false
var holding_breath := false
var hidden_in: HidingSpot = null
var dead := false
var controls_enabled := true
## 0..1: насколько близко Сторож. От этого шумит экран, стучит сердце, дрожат руки.
var fear := 0.0
## Счётчики зон, в которых стоит игрок (зоны сами их меняют).
var creaky_boards := 0
var grass_zones := 0
var focused: Interactable = null
## Что подобрано за эту ночь (для контрольных точек).
var picked_ids: Array[String] = []

# --- Статистика для финального экрана ---
var flashes_used := 0
var time_hidden := 0.0

var _gravity: float = ProjectSettings.get_setting("physics/3d/default_gravity")
var _yaw := 0.0
var _pitch := 0.0
var _hide_yaw := 0.0
var _hide_pitch := 0.0
var _height := 0.0
var _step_dist := 0.0
var _stamina_wait := 0.0
var _exhausted := false
var _pant_timer := 0.0
var _breath_timer := 0.0
var _breath_lock := 0.0
var _flash_cd := 0.0
var _heart_timer := 0.0
var _shake := 0.0
var _time := 0.0
var _tremor := FastNoiseLite.new()
var _view_tween: Tween


func _ready() -> void:
	add_to_group(&"player")
	stamina = stamina_max
	breath = breath_hold_max
	_height = stand_height
	_yaw = rotation.y
	_tremor.frequency = 0.8
	flashlight.visible = false
	flash_burst.visible = false
	interact_ray.add_exception(self)
	if breath_player.stream:
		AudioBus._make_looping(breath_player.stream)
	_apply_height()


# --- Обзор ------------------------------------------------------------------

## Повернуть взгляд (радианы). Мышь приходит из game.gd, стик — из _process.
func look(yaw_delta: float, pitch_delta: float) -> void:
	if dead or not controls_enabled:
		return
	_yaw += yaw_delta
	_pitch = clampf(_pitch + pitch_delta, -PITCH_LIMIT, PITCH_LIMIT)
	if hidden_in:
		var yaw_lim := deg_to_rad(hidden_in.look_yaw_limit)
		_yaw = _hide_yaw + clampf(angle_difference(_hide_yaw, _yaw), -yaw_lim, yaw_lim)
		var pitch_lim := deg_to_rad(hidden_in.look_pitch_limit)
		_pitch = clampf(_pitch, _hide_pitch - pitch_lim, _hide_pitch + pitch_lim)
	_apply_view()


func look_mouse(screen_relative: Vector2) -> void:
	var k := mouse_radians_per_pixel * GameState.mouse_sensitivity
	var invert := -1.0 if GameState.invert_y else 1.0
	look(-screen_relative.x * k, -screen_relative.y * k * invert)


func _apply_view() -> void:
	rotation.y = _yaw
	head.rotation.x = _pitch


func _process(delta: float) -> void:
	_time += delta
	var stick := Input.get_vector("look_left", "look_right", "look_up", "look_down")
	if stick != Vector2.ZERO:
		var invert := -1.0 if GameState.invert_y else 1.0
		look(-stick.x * gamepad_look_speed * delta, -stick.y * gamepad_look_speed * delta * invert)
	_update_fear(delta)
	_update_camera_fx(delta)


# --- Физика и действия -------------------------------------------------------

func _physics_process(delta: float) -> void:
	_flash_cd -= delta
	_update_flashlight(delta)
	if dead:
		return
	if hidden_in:
		_process_hidden(delta)
		return
	_process_movement(delta)
	_update_focus()
	if not controls_enabled:
		return
	if Input.is_action_just_pressed("interact") and focused:
		focused.interact(self)
	if Input.is_action_just_pressed("flashlight"):
		toggle_flashlight()
	aiming = Input.is_action_pressed("camera_aim")
	if Input.is_action_just_pressed("flash"):
		fire_flash()


func _process_movement(delta: float) -> void:
	var input := Vector2.ZERO
	if controls_enabled:
		input = Input.get_vector("move_left", "move_right", "move_forward", "move_back")

	if controls_enabled and Input.is_action_pressed("crouch"):
		crouching = true
	elif crouching and _can_stand():
		crouching = false

	var moving := input.length() > 0.1
	var want_sprint := controls_enabled and Input.is_action_pressed("sprint") and moving \
			and not crouching and not _exhausted
	sprinting = want_sprint and stamina > 0.0
	_update_stamina(delta)

	var speed := walk_speed
	if crouching:
		speed = crouch_speed
	elif sprinting:
		speed = sprint_speed
	if aiming:
		speed *= 0.6

	var dir := global_basis * Vector3(input.x, 0.0, input.y)
	dir.y = 0.0
	dir = dir.normalized() * minf(input.length(), 1.0)
	var blend := 1.0 - exp(-acceleration * delta)
	velocity.x = lerpf(velocity.x, dir.x * speed, blend)
	velocity.z = lerpf(velocity.z, dir.z * speed, blend)
	if not is_on_floor():
		velocity.y -= _gravity * delta
	move_and_slide()

	_height = move_toward(_height, crouch_height if crouching else stand_height, delta * 4.0)
	_apply_height()

	var horizontal := Vector2(velocity.x, velocity.z).length()
	if is_on_floor() and horizontal > 0.3:
		_step_dist += horizontal * delta
		var stride := 0.55 if crouching else (0.85 if sprinting else 0.7)
		# лёгкое покачивание головы в такт шагам
		head.position.y += sin(_step_dist / stride * PI) * 0.025 * horizontal / walk_speed
		if _step_dist >= stride:
			_step_dist = 0.0
			_footstep()


func _update_stamina(delta: float) -> void:
	if sprinting:
		stamina = maxf(stamina - delta, 0.0)
		_stamina_wait = stamina_regen_delay
		if stamina <= 0.0:
			_exhausted = true
	else:
		_stamina_wait -= delta
		if _stamina_wait <= 0.0:
			stamina = minf(stamina + stamina_regen * delta, stamina_max)
		if _exhausted and stamina > stamina_max * 0.4:
			_exhausted = false
	# Запыхался — тяжело дышит, и это тоже слышно.
	if _exhausted:
		_pant_timer -= delta
		if _pant_timer <= 0.0:
			_pant_timer = 1.0
			Noises.make(global_position, noise_panting, &"breath")
	breath_player.volume_db = -10.0 if _exhausted else -18.0
	var want_breath_sound := _exhausted or (hidden_in != null and not holding_breath)
	if want_breath_sound and not breath_player.playing:
		breath_player.play()
	elif not want_breath_sound and breath_player.playing:
		breath_player.stop()


func _apply_height() -> void:
	var capsule := collision_shape.shape as CapsuleShape3D
	capsule.height = _height
	collision_shape.position.y = _height * 0.5
	head.position.y = _height - eye_offset


func _can_stand() -> bool:
	return not test_move(global_transform, Vector3.UP * (stand_height - _height + 0.05))


func _footstep() -> void:
	var on_ground := _floor_surface() == &"ground"
	footsteps.stream = AudioBus.pick("step_ground", 3) if on_ground else AudioBus.pick("step_wood", 4)
	footsteps.volume_db = -16.0 if crouching else (-2.0 if sprinting else -9.0)
	footsteps.pitch_scale = randf_range(0.9, 1.1)
	footsteps.play()

	var radius := noise_walk
	var source := &"walk"
	if crouching:
		radius = noise_crouch
	elif sprinting:
		radius = noise_run
		source = &"run"
	if creaky_boards > 0 and not crouching:
		radius = maxf(radius, noise_creak_run if sprinting else noise_creak)
		source = &"creak"
		AudioBus.play_3d(AudioBus.pick("creak", 2), global_position, 0.0)
	Noises.make(global_position, radius, source)


func _floor_surface() -> StringName:
	for i in get_slide_collision_count():
		var c := get_slide_collision(i)
		if c.get_normal().y > 0.7 and c.get_collider() is Block:
			return (c.get_collider() as Block).surface
	return &"wood"


func _update_focus() -> void:
	focused = null
	if not controls_enabled or not interact_ray.is_colliding():
		return
	var collider := interact_ray.get_collider()
	if collider is Interactable and collider.can_interact(self):
		focused = collider


## Текст подсказки для HUD, пустая строка — подсказки нет.
func get_focus_prompt() -> String:
	if dead or not controls_enabled:
		return ""
	if hidden_in:
		return "Вылезти"
	if focused:
		return focused.get_prompt(self)
	return ""


# --- Фонарик -------------------------------------------------------------------

func toggle_flashlight() -> void:
	if hidden_in or dead:
		return
	AudioBus.play_ui(AudioBus.get_stream("flashlight_click"), -6.0)
	Noises.make(global_position, noise_flashlight_click, &"click")
	if not light_on and battery <= 0.0:
		message.emit("Батарейка села")
		return
	light_on = not light_on


func _update_flashlight(delta: float) -> void:
	if light_on:
		battery = maxf(battery - delta / battery_seconds, 0.0)
		if battery <= 0.0:
			light_on = false
			message.emit("Фонарик погас")
	var energy := flashlight_energy
	if light_on and battery < 0.15:
		# Батарейка садится: свет тускнеет и мигает.
		energy *= remap(battery, 0.0, 0.15, 0.35, 1.0)
		if randf() < 0.06:
			energy *= 0.2
	flashlight.visible = light_on
	flashlight.light_energy = energy
	# Руки дрожат от страха — луч дребезжит.
	var tremble := 0.01 + fear * fear * 0.07
	flashlight.rotation = Vector3(
		_tremor.get_noise_1d(_time * 60.0) * tremble,
		_tremor.get_noise_1d(_time * 60.0 + 500.0) * tremble, 0.0)


# --- Камера Кости ------------------------------------------------------------

func fire_flash() -> void:
	if hidden_in or dead or _flash_cd > 0.0:
		return
	if flash_charges <= 0:
		message.emit("Вспышка не заряжена")
		AudioBus.play_ui(AudioBus.get_stream("flashlight_click"), -8.0)
		return
	flash_charges -= 1
	flashes_used += 1
	_flash_cd = flash_cooldown
	AudioBus.play_ui(AudioBus.get_stream("camera_flash"), -2.0)
	Noises.make(global_position, noise_flash, &"flash")
	flash_fired.emit()

	flash_burst.visible = true
	flash_burst.light_energy = 6.0
	var t := create_tween()
	t.tween_property(flash_burst, "light_energy", 0.0, 0.3)
	t.tween_callback(func() -> void: flash_burst.visible = false)

	var forward := -camera.global_basis.z
	for s: Storozh in get_tree().get_nodes_in_group(&"storozh"):
		var eyes := s.get_eyes_position()
		var to := eyes - camera.global_position
		if to.length() > flash_range:
			continue
		if rad_to_deg(forward.angle_to(to)) > flash_angle:
			continue
		if _line_clear(camera.global_position, eyes, s):
			s.blind(flash_blind_time)


func _line_clear(from: Vector3, to: Vector3, target: Node) -> bool:
	var query := PhysicsRayQueryParameters3D.create(from, to, LAYER_WORLD | LAYER_DOOR, [get_rid()])
	var hit := get_world_3d().direct_space_state.intersect_ray(query)
	return hit.is_empty() or hit.collider == target


# --- Укрытия и дыхание -------------------------------------------------------

func enter_hiding(spot: HidingSpot) -> void:
	if hidden_in or dead:
		return
	hidden_in = spot
	spot.occupant = self
	light_on = false
	aiming = false
	crouching = false
	sprinting = false
	velocity = Vector3.ZERO
	collision_shape.disabled = true
	_height = stand_height
	_apply_height()
	# Сторож узнаёт, что игрок спрятался. Если он в этот момент видел игрока — запомнит укрытие.
	get_tree().call_group(&"storozh", &"on_player_hid", spot)

	var vp := spot.view_point.global_transform
	var euler := vp.basis.get_euler()
	_hide_yaw = euler.y
	_hide_pitch = euler.x
	AudioBus.play_ui(AudioBus.get_stream("pickup"), -10.0)
	_move_view_to(vp.origin - Vector3(0.0, head.position.y, 0.0), _hide_yaw, _hide_pitch, 0.45)
	hidden_changed.emit(true)


func exit_hiding() -> void:
	if hidden_in == null:
		return
	var spot := hidden_in
	var exit := spot.exit_point.global_transform
	_move_view_to(exit.origin, exit.basis.get_euler().y, 0.0, 0.4, func() -> void:
		collision_shape.disabled = false
		hidden_in = null
		spot.occupant = null
		holding_breath = false
		hidden_changed.emit(false))
	Noises.make(exit.origin, 2.0, &"walk")


func _process_hidden(delta: float) -> void:
	time_hidden += delta
	_breath_lock -= delta
	var want_hold := controls_enabled and Input.is_action_pressed("hold_breath") and _breath_lock <= 0.0
	if want_hold and breath > 0.0:
		holding_breath = true
		breath = maxf(breath - delta, 0.0)
		if breath <= 0.0:
			_gasp()
	else:
		holding_breath = false
		breath = minf(breath + breath_regen * delta, breath_hold_max)
		_breath_timer -= delta
		if _breath_timer <= 0.0:
			_breath_timer = breath_noise_interval
			Noises.make(head.global_position, breath_noise_radius, &"breath")
	_update_stamina(delta)
	if controls_enabled and Input.is_action_just_pressed("interact"):
		exit_hiding()


func _gasp() -> void:
	holding_breath = false
	_breath_lock = gasp_lock_time
	AudioBus.play_ui(AudioBus.get_stream("gasp"), 0.0)
	Noises.make(head.global_position, noise_gasp, &"gasp")


## Плавно перенести тело и взгляд (заход в укрытие, выход, поимка).
func _move_view_to(target_pos: Vector3, target_yaw: float, target_pitch: float,
		duration: float, on_done: Callable = Callable()) -> void:
	controls_enabled = false
	if _view_tween:
		_view_tween.kill()
	var from_pos := global_position
	var from_yaw := _yaw
	var from_pitch := _pitch
	var yaw_diff := angle_difference(from_yaw, target_yaw)
	_view_tween = create_tween().set_process_mode(Tween.TWEEN_PROCESS_PHYSICS)
	_view_tween.tween_method(func(k: float) -> void:
		var e := ease(k, -2.0)
		global_position = from_pos.lerp(target_pos, e)
		_yaw = from_yaw + yaw_diff * e
		_pitch = lerpf(from_pitch, target_pitch, e)
		_apply_view(), 0.0, 1.0, duration)
	_view_tween.tween_callback(func() -> void:
		if not dead:
			controls_enabled = true
		if on_done.is_valid():
			on_done.call())


# --- Подбор предметов --------------------------------------------------------

func collect(item: Pickup) -> void:
	match item.kind:
		Pickup.Kind.BATTERY:
			battery = minf(battery + battery_per_pickup, 1.0)
			message.emit("Новая батарейка — фонарик светит ярче")
		Pickup.Kind.FLASH_CHARGE:
			flash_charges += 1
			message.emit("Аккумулятор вспышки: зарядов %d" % flash_charges)
	if item.pickup_id != "":
		picked_ids.append(item.pickup_id)


# --- Страх и поимка ------------------------------------------------------------

func _update_fear(delta: float) -> void:
	var target := 0.0
	for s: Storozh in get_tree().get_nodes_in_group(&"storozh"):
		target = maxf(target, s.get_fear_for(self))
	fear = lerpf(fear, target, 1.0 - exp(-3.0 * delta))

	# Сердце: чем ближе Сторож, тем чаще и громче.
	if fear > 0.06 and not dead:
		_heart_timer -= delta
		if _heart_timer <= 0.0:
			_heart_timer = lerpf(1.3, 0.36, fear)
			heart_player.volume_db = lerpf(-30.0, -1.0, fear)
			heart_player.play()


func _update_camera_fx(delta: float) -> void:
	_shake = maxf(_shake - delta * 1.5, 0.0)
	var amount := fear * fear * 0.012 + _shake * 0.08
	camera.h_offset = _tremor.get_noise_1d(_time * 35.0 + 1000.0) * amount
	camera.v_offset = _tremor.get_noise_1d(_time * 35.0 + 2000.0) * amount
	var target_fov := fov_aim if aiming else fov_normal
	camera.fov = lerpf(camera.fov, target_fov, 1.0 - exp(-10.0 * delta))


func on_caught(storozh: Storozh, reason: StringName) -> void:
	if dead:
		return
	dead = true
	controls_enabled = false
	holding_breath = false
	aiming = false
	breath_player.stop()
	if hidden_in:
		hidden_in.occupant = null
		hidden_in = null
	_shake = 1.0
	AudioBus.play_ui(AudioBus.get_stream("catch_scream"), 0.0)
	# Взгляд рывком на лицо Сторожа.
	var dir := storozh.get_eyes_position() - head.global_position
	var yaw := atan2(-dir.x, -dir.z)
	var pitch := atan2(dir.y, Vector2(dir.x, dir.z).length())
	_move_view_to(global_position, yaw, clampf(pitch, -PITCH_LIMIT, PITCH_LIMIT), 0.2)
	caught.emit(storozh, reason)


func get_eye_position() -> Vector3:
	return head.global_position


func get_center_position() -> Vector3:
	return global_position + Vector3.UP * (_height * 0.5)


func is_hidden() -> bool:
	return hidden_in != null
