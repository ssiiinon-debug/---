# Сторож — существо из погоста. Конечный автомат из диздока (раздел «Сторож»):
#
#   Бродит --шум--> Проверяет шум --видит--> Погоня --догнал--> Поимка
#   Проверяет шум --никого--> Ищет рядом
#   Погоня --потерял--> Ищет рядом,  Погоня --вспышка--> Ослеплён --очнулся--> Ищет рядом
#   Ищет рядом --не нашёл--> Бродит
#
# Сверх схемы: если он видит игрока прямо во время брожения или поиска — сразу погоня,
# а до начала ночи он «спит» в подполе (DORMANT).
#
# Главное правило: Сторож не всевидящий. Он идёт на звук и свет, и игрок всегда
# может понять, почему его нашли (причина пишется на экране смерти).
class_name Storozh
extends CharacterBody3D

signal state_changed(new_state: State)

enum State { DORMANT, WANDER, INVESTIGATE, CHASE, CATCH, BLINDED, SEARCH }

const STATE_NAMES := {
	State.DORMANT: "Спит",
	State.WANDER: "Бродит",
	State.INVESTIGATE: "Проверяет шум",
	State.CHASE: "Погоня",
	State.CATCH: "Поимка",
	State.BLINDED: "Ослеплён",
	State.SEARCH: "Ищет рядом",
}

const LAYER_WORLD := 1
const LAYER_DOOR := 1 << 4

@export_group("Скорость (м/с в среднем, с учётом замираний)")
@export var wander_speed := 1.2
@export var investigate_speed := 1.9
@export var chase_speed := 3.8
## Прибавка скорости за каждый час ночи.
@export var speed_per_hour := 0.12

@export_group("Зрение")
@export var view_distance := 11.0
## Игрок присел и без фонарика — его видно только ближе.
@export var view_distance_crouch := 6.0
## Присел в высокой траве — только вплотную.
@export var view_distance_grass := 2.0
## Включённый фонарик видно издалека, но с такого расстояния он идёт к месту, а не в погоню.
@export var light_view_distance := 28.0
@export var view_angle := 110.0
## Вплотную он чует игрока даже спиной.
@export var close_sense_distance := 1.8
@export var view_per_hour := 0.5

@export_group("Слух")
## Множитель радиуса любого шума.
@export var hearing := 1.0
@export var hearing_per_hour := 0.1

@export_group("Поведение")
@export var catch_distance := 1.3
## Сколько секунд он гонится за местом, где последний раз видел игрока.
@export var lose_sight_time := 3.0
@export var search_time := 14.0
@export var search_radius := 6.0
## Шанс, что во время поиска он подойдёт к укрытию и прислушается.
@export var check_spot_chance := 0.45
## Если долго бродит без толку — появляется ближе к игроку (из окна или подпола).
@export var relocate_after := 40.0
@export var relocate_min := 9.0
@export var relocate_max := 18.0

@onready var agent: NavigationAgent3D = $NavigationAgent3D
@onready var model: Node3D = $Model
@onready var head_pivot: Node3D = $Model/HeadPivot
@onready var eyes: Node3D = $Model/HeadPivot/Eyes
@onready var voice: AudioStreamPlayer3D = $Voice

var state := State.DORMANT
## Час ночи (0..4), его выставляет game.gd. С каждым часом он слышит дальше и ходит быстрее.
var hour := 0
var player: Player
## Что его привлекло в последний раз (ключ из Noises.DESCRIPTIONS).
var alert_source: StringName = &"sight"
var catch_reason: StringName = &"chase"
## Укрытие, в которое игрок залез у него на глазах.
var remembered_spot: HidingSpot = null
var times_spotted := 0

var _gravity: float = ProjectSettings.get_setting("physics/3d/default_gravity")
var _state_time := 0.0
var _since_seen := INF
var _last_seen_pos := Vector3.ZERO
var _search_center := Vector3.ZERO
var _waiting := false
var _pause_time := 0.0
var _gait_timer := 0.0
var _gait_moving := true
var _sense_timer := 0.0
var _repath_timer := 0.0
var _voice_timer := 4.0
var _step_dist := 0.0
var _blind_time := 0.0
var _twitch_timer := 1.0
var _blink_timer := 3.0
var _wander_idle := 0.0
var _model_base_y := 0.0


func _ready() -> void:
	add_to_group(&"storozh")
	Noises.emitted.connect(_on_noise)
	_model_base_y = model.position.y


func _physics_process(delta: float) -> void:
	if player == null:
		player = get_tree().get_first_node_in_group(&"player") as Player
	_state_time += delta
	_since_seen += delta
	_pause_time = maxf(_pause_time - delta, 0.0)
	_repath_timer -= delta
	_sense_timer -= delta
	if _sense_timer <= 0.0:
		_sense_timer = 0.1
		_update_vision()

	var speed := 0.0
	match state:
		State.WANDER:
			speed = _process_wander(delta)
		State.INVESTIGATE:
			speed = _process_investigate()
		State.CHASE:
			speed = _process_chase()
		State.SEARCH:
			speed = _process_search()
		State.BLINDED:
			_blind_time -= delta
			if _blind_time <= 0.0:
				_start_search(global_position)  # очнулся
	_move(delta, speed)
	_update_voice(delta)
	_animate(delta)


# --- Состояния ---------------------------------------------------------------

func _set_state(new_state: State) -> void:
	if state == new_state:
		return
	state = new_state
	_state_time = 0.0
	_waiting = false
	_pause_time = 0.0
	state_changed.emit(new_state)


## Проснуться в начале ночи (зовёт game.gd по сценарию).
func wake() -> void:
	if state == State.DORMANT:
		_set_state(State.WANDER)
		_next_patrol_point()


func _process_wander(delta: float) -> float:
	_wander_idle += delta
	if _arrived():
		if not _waiting:
			_waiting = true
			_pause_time = randf_range(1.0, 3.0)
		elif _pause_time <= 0.0:
			_waiting = false
			_next_patrol_point()
	if _wander_idle > relocate_after:
		_try_relocate()
	return wander_speed + speed_per_hour * hour


func _investigate(pos: Vector3, source: StringName) -> void:
	alert_source = source
	_go_to(_closest_nav_point(pos), true)
	if state != State.INVESTIGATE:
		_set_state(State.INVESTIGATE)
		if randf() < 0.3:
			_say("storozh_laugh")


func _process_investigate() -> float:
	if _arrived() or _state_time > 25.0:
		_start_search(agent.target_position)  # никого
	return investigate_speed + speed_per_hour * hour


func _start_chase() -> void:
	times_spotted += 1
	catch_reason = &"chase"
	remembered_spot = null
	_set_state(State.CHASE)
	AudioBus.set_chase(true)
	AudioBus.play_ui(AudioBus.get_stream("chase_sting"), -3.0)
	_say("storozh_laugh")


func _process_chase() -> float:
	var speed := chase_speed + speed_per_hour * hour
	if player == null or player.dead:
		return 0.0
	if remembered_spot:
		if player.hidden_in != remembered_spot:
			remembered_spot = null
		else:
			# Видел, куда игрок залез (или услышал дыхание) — идёт прямо к укрытию.
			var spot_pos := remembered_spot.exit_point.global_position
			_go_to(spot_pos)
			if _flat_distance(spot_pos) < 1.1 or _arrived():
				_catch(catch_reason)
			return speed
	if not player.is_hidden() and _since_seen < 0.25:
		_go_to(player.global_position)
		if _flat_distance(player.global_position) < catch_distance \
				and absf(player.global_position.y - global_position.y) < 1.5:
			_catch(&"chase")
	else:
		_go_to(_last_seen_pos)
		if _since_seen > lose_sight_time or (_arrived() and _since_seen > 1.0):
			_start_search(_last_seen_pos)  # потерял
	return speed


func _catch(reason: StringName) -> void:
	catch_reason = reason
	_set_state(State.CATCH)
	velocity = Vector3.ZERO
	AudioBus.set_chase(false)
	if player:
		var to := player.global_position - global_position
		rotation.y = atan2(-to.x, -to.z)
		player.on_caught(self, reason)


## Вспышка камеры: замирает и ничего не видит пару секунд.
func blind(duration: float) -> void:
	if state in [State.CATCH, State.DORMANT]:
		return
	_blind_time = duration
	_set_state(State.BLINDED)
	AudioBus.set_chase(false)
	_say("storozh_screech", true)


func _start_search(center: Vector3) -> void:
	_search_center = center
	_set_state(State.SEARCH)
	AudioBus.set_chase(false)
	_next_search_point()


func _process_search() -> float:
	if _state_time > search_time:
		_set_state(State.WANDER)  # не нашёл
		_next_patrol_point()
		return 0.0
	if _arrived():
		if not _waiting:
			_waiting = true
			_pause_time = randf_range(1.5, 3.0)
		elif _pause_time <= 0.0:
			_waiting = false
			_next_search_point()
	return investigate_speed + speed_per_hour * hour


func _next_search_point() -> void:
	# Иногда подходит к укрытию и прислушивается — тут игроку надо не дышать.
	var spots: Array[HidingSpot] = []
	for spot: HidingSpot in get_tree().get_nodes_in_group(&"hiding_spots"):
		if spot.exit_point.global_position.distance_to(_search_center) < search_radius + 2.0:
			spots.append(spot)
	if not spots.is_empty() and randf() < check_spot_chance:
		_go_to(spots.pick_random().exit_point.global_position, true)
		return
	var offset := Vector3(randf_range(-1.0, 1.0), 0.0, randf_range(-1.0, 1.0)) * search_radius
	_go_to(_closest_nav_point(_search_center + offset), true)


func _next_patrol_point() -> void:
	var points := get_tree().get_nodes_in_group(&"storozh_patrol")
	if points.is_empty():
		var offset := Vector3(randf_range(-10.0, 10.0), 0.0, randf_range(-10.0, 10.0))
		_go_to(_closest_nav_point(global_position + offset), true)
		return
	var target: Node3D = points.pick_random()
	# В 40% случаев идёт к точке ближе всего к игроку: давление не ослабевает.
	if player and randf() < 0.4:
		var best := INF
		for p: Node3D in points:
			var d := p.global_position.distance_to(player.global_position)
			if d < best:
				best = d
				target = p
	_go_to(target.global_position, true)


## Долго бродит впустую — тихо «переходит» к игроку: туда, куда тот сейчас не смотрит.
func _try_relocate() -> void:
	_wander_idle = 0.0
	if player == null or player.dead:
		return
	var candidates: Array[Node3D] = []
	for spawn: Node3D in get_tree().get_nodes_in_group(&"storozh_spawn"):
		var d := spawn.global_position.distance_to(player.global_position)
		if d < relocate_min or d > relocate_max:
			continue
		if _player_can_see_point(spawn.global_position + Vector3.UP * 1.5):
			continue
		candidates.append(spawn)
	if candidates.is_empty():
		return
	var spawn: Node3D = candidates.pick_random()
	global_position = spawn.global_position
	velocity = Vector3.ZERO
	if spawn.has_meta(&"window"):
		AudioBus.play_3d(AudioBus.get_stream("storozh_tap"), spawn.global_position, 0.0, 35.0)
	_next_patrol_point()


func _player_can_see_point(point: Vector3) -> bool:
	var cam := player.camera
	var to := point - cam.global_position
	if (-cam.global_basis.z).angle_to(to) > deg_to_rad(70.0):
		return false
	return _line_clear(cam.global_position, point)


# --- Чувства -----------------------------------------------------------------

func _update_vision() -> void:
	if player == null or player.dead:
		return
	if state in [State.DORMANT, State.CATCH, State.BLINDED]:
		return
	var seen := _check_vision()
	if seen == 2:
		_last_seen_pos = player.global_position
		_since_seen = 0.0
		if state != State.CHASE:
			if state != State.INVESTIGATE:
				alert_source = &"light" if player.light_on else &"sight"
			_start_chase()
	elif seen == 1 and state != State.CHASE:
		_investigate(player.global_position, &"light")


## 0 — не видит, 1 — видит только свет фонарика издалека, 2 — видит игрока.
func _check_vision() -> int:
	if player.is_hidden():
		return 0
	var from := get_eyes_position()
	var target := player.get_center_position()
	var to := target - from
	var dist := to.length()

	var sight := view_distance + view_per_hour * hour
	if player.crouching and not player.light_on:
		sight = view_distance_grass if player.grass_zones > 0 else view_distance_crouch
	var max_dist := maxf(sight, light_view_distance) if player.light_on else sight
	if dist > max_dist:
		return 0

	if dist > close_sense_distance:
		var forward := -global_basis.z
		var flat := Vector3(to.x, 0.0, to.z)
		if rad_to_deg(forward.angle_to(flat)) > view_angle * 0.5:
			return 0
	if not (_line_clear(from, target) or _line_clear(from, player.get_eye_position())):
		return 0
	return 2 if dist <= sight else 1


func _on_noise(pos: Vector3, radius: float, source: StringName) -> void:
	if state in [State.CATCH, State.BLINDED]:
		return
	var heard := radius * (hearing + hearing_per_hour * hour)
	if global_position.distance_to(pos) > heard:
		return
	if state == State.DORMANT:
		wake()
	if source == &"breath" and player and player.is_hidden():
		_found_hidden_player(&"breath")
		return
	if state == State.CHASE and _since_seen < 0.5:
		return  # пока видит игрока, его ведут глаза, а не уши
	_investigate(pos, source)


## Игрок залез в укрытие. Если в этот момент Сторож его видел — запоминает место.
func on_player_hid(spot: HidingSpot) -> void:
	if state == State.CHASE and _since_seen < 0.6:
		remembered_spot = spot
		catch_reason = &"seen_hiding"


func _found_hidden_player(reason: StringName) -> void:
	remembered_spot = player.hidden_in
	if state != State.CHASE:
		alert_source = reason
		_set_state(State.CHASE)
		AudioBus.set_chase(true)
		AudioBus.play_ui(AudioBus.get_stream("chase_sting"), -3.0)
	catch_reason = reason


func _line_clear(from: Vector3, to: Vector3) -> bool:
	var query := PhysicsRayQueryParameters3D.create(from, to, LAYER_WORLD | LAYER_DOOR, [get_rid()])
	return get_world_3d().direct_space_state.intersect_ray(query).is_empty()


# --- Движение ------------------------------------------------------------------

func _go_to(pos: Vector3, force := false) -> void:
	# Не пересчитываем путь каждый кадр: только если цель заметно сдвинулась.
	if not force and _repath_timer > 0.0:
		return
	if force or agent.target_position.distance_squared_to(pos) > 0.09:
		agent.target_position = pos
		_repath_timer = 0.15


func _arrived() -> bool:
	return agent.is_navigation_finished()


func _closest_nav_point(pos: Vector3) -> Vector3:
	return NavigationServer3D.map_get_closest_point(get_world_3d().navigation_map, pos)


func _flat_distance(pos: Vector3) -> float:
	return Vector2(pos.x - global_position.x, pos.z - global_position.z).length()


func _move(delta: float, avg_speed: float) -> void:
	var horizontal := Vector3.ZERO
	if avg_speed > 0.0 and _pause_time <= 0.0 and not agent.is_navigation_finished():
		# Рваная походка: то замирает, то делает несколько быстрых шагов.
		_gait_timer -= delta
		if _gait_timer <= 0.0:
			_gait_moving = not _gait_moving
			if state == State.CHASE:
				_gait_timer = randf_range(1.4, 2.6) if _gait_moving else randf_range(0.12, 0.25)
			else:
				_gait_timer = randf_range(0.8, 2.0) if _gait_moving else randf_range(0.3, 1.1)
		if _gait_moving:
			# Средняя скорость с учётом замираний = avg_speed, поэтому рывки быстрее.
			var burst := avg_speed / (0.9 if state == State.CHASE else 0.65)
			var to_next := agent.get_next_path_position() - global_position
			to_next.y = 0.0
			if to_next.length() > 0.01:
				horizontal = to_next.normalized() * burst
	velocity.x = horizontal.x
	velocity.z = horizontal.z
	velocity.y = velocity.y - _gravity * delta if not is_on_floor() else -0.1
	move_and_slide()

	if horizontal.length() > 0.1:
		var turn := 10.0 if state == State.CHASE else 4.0
		rotation.y = rotate_toward(rotation.y, atan2(-horizontal.x, -horizontal.z), turn * delta)
		_step_dist += horizontal.length() * delta
		if _step_dist > 1.1:
			_step_dist = 0.0
			var vol := 2.0 if state == State.CHASE else -4.0
			AudioBus.play_3d(AudioBus.pick("storozh_step", 2), global_position, vol, 28.0)


# --- Голос и анимация ----------------------------------------------------------

func _say(sound_name: String, interrupt := false) -> void:
	if voice.playing and not interrupt:
		return
	voice.stream = AudioBus.get_stream(sound_name)
	voice.play()


func _update_voice(delta: float) -> void:
	if state in [State.DORMANT, State.CATCH]:
		return
	_voice_timer -= delta
	if _voice_timer > 0.0:
		return
	# Фирменные щелчки из глотки: игрок по ним понимает, где Сторож.
	_voice_timer = randf_range(2.0, 3.5) if state == State.CHASE else randf_range(3.5, 7.0)
	if state == State.WANDER and randf() < 0.12:
		_say("storozh_laugh")
	else:
		_say("storozh_click_%d" % randi_range(1, 3))


func _animate(delta: float) -> void:
	var moving := Vector2(velocity.x, velocity.z).length() > 0.1
	var bob := absf(sin(_step_dist / 1.1 * PI)) * 0.06 if moving else 0.0
	model.position.y = _model_base_y + bob

	if state == State.BLINDED:
		head_pivot.rotation = Vector3(randf_range(-0.3, 0.3), randf_range(-0.4, 0.4), randf_range(-0.4, 0.4))
		return
	# Голова иногда дёргается под неестественным углом.
	_twitch_timer -= delta
	if _twitch_timer <= 0.0:
		_twitch_timer = randf_range(0.6, 3.0)
		var lean := 0.25 if state == State.CHASE else 0.0
		head_pivot.rotation = Vector3(lean + randf_range(-0.1, 0.15), randf_range(-0.3, 0.3), randf_range(-0.5, 0.5))
	# Изредка «моргает» — огоньки глаз гаснут на миг.
	_blink_timer -= delta
	if _blink_timer <= 0.0:
		eyes.visible = not eyes.visible
		_blink_timer = randf_range(2.0, 6.0) if eyes.visible else 0.12


## Рассвет: Сторож уходит в землю.
func retreat() -> void:
	_set_state(State.DORMANT)
	set_physics_process(false)
	AudioBus.set_chase(false)
	_say("storozh_laugh", true)
	var t := create_tween()
	t.tween_property(model, "position:y", -3.0, 2.5).set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_IN)
	t.tween_callback(hide)


# --- Для других скриптов -------------------------------------------------------

func get_eyes_position() -> Vector3:
	return eyes.global_position


func get_state_name() -> String:
	return STATE_NAMES[state]


## Насколько страшно игроку (0..1): близко или в погоне — экран шумит, сердце колотится.
func get_fear_for(p: Player) -> float:
	if state == State.DORMANT or not visible:
		return 0.0
	var d := global_position.distance_to(p.global_position)
	var f := clampf(1.0 - (d - 2.0) / 14.0, 0.0, 1.0)
	if state == State.CHASE:
		f = maxf(f, 0.75)
	return f
