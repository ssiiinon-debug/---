# Дверь на петлях. Корень сцены стоит в точке петли, створка — в Hinge/Panel.
# Игрок открывает по E (дверь скрипит — это шум). Сторож двери не открывает руками:
# подходит вплотную, и створка с грохотом распахивается.
class_name Door
extends Interactable

@export var open_angle := 100.0
@export var open_time := 0.6
@export var creak_noise_radius := 7.0
@export var slam_noise_radius := 12.0
@export var start_open := false

@onready var hinge: Node3D = $Hinge
@onready var enemy_sensor: Area3D = $EnemySensor

var is_open := false
var _tween: Tween
## Открывать от игрока: знак угла выбирается по тому, с какой стороны он стоит.
var _open_sign := 1.0


func _ready() -> void:
	super()
	enemy_sensor.body_entered.connect(_on_enemy_near)
	if start_open:
		is_open = true
		hinge.rotation.y = deg_to_rad(open_angle)


func get_prompt(_player: Player) -> String:
	return "Закрыть дверь" if is_open else "Открыть дверь"


func interact(player: Player) -> void:
	if not is_open:
		_open_sign = _side_sign(player.global_position)
	_set_open(not is_open, open_time)
	AudioBus.play_3d(AudioBus.get_stream("door_creak"), global_position, -2.0)
	Noises.make(global_position, creak_noise_radius, &"door")


func _on_enemy_near(body: Node3D) -> void:
	if is_open or not body is Storozh:
		return
	_open_sign = _side_sign(body.global_position)
	_set_open(true, 0.15)
	AudioBus.play_3d(AudioBus.get_stream("door_slam"), global_position, 2.0, 40.0)
	Noises.make(global_position, slam_noise_radius, &"door")


func _side_sign(from: Vector3) -> float:
	# Открываем «от себя»: створка уходит в сторону, противоположную гостю.
	# Створка лежит вдоль +X от петли, положительный угол уводит её к -Z.
	var local := to_local(from)
	return 1.0 if local.z > 0.0 else -1.0


func _set_open(value: bool, duration: float) -> void:
	is_open = value
	if _tween:
		_tween.kill()
	_tween = create_tween().set_process_mode(Tween.TWEEN_PROCESS_PHYSICS)
	var target := deg_to_rad(open_angle) * _open_sign if value else 0.0
	_tween.tween_property(hinge, "rotation:y", target, duration) \
			.set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_OUT)
