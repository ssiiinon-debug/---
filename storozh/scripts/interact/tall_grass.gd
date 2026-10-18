# Высокая трава: укрытие без кнопки. Если присесть внутри, Сторож замечает
# игрока только вплотную (см. view_distance_grass у Сторожа).
# Травинки расставляются сами по размеру зоны, поэтому в редакторе меняешь только size.
@tool
class_name TallGrass
extends Area3D

@export var size := Vector3(3.0, 1.2, 3.0):
	set(value):
		size = value
		_rebuild()
## Сколько пучков травы на квадратный метр.
@export var density := 7.0:
	set(value):
		density = value
		_rebuild()
@export var material: Material:
	set(value):
		material = value
		_rebuild()

var _shape: CollisionShape3D
var _multimesh: MultiMeshInstance3D


func _ready() -> void:
	collision_layer = 0
	collision_mask = 1 << 1  # слой player
	_rebuild()
	if Engine.is_editor_hint():
		return
	body_entered.connect(func(body: Node3D) -> void:
		if body is Player:
			body.grass_zones += 1)
	body_exited.connect(func(body: Node3D) -> void:
		if body is Player:
			body.grass_zones = maxi(body.grass_zones - 1, 0))


func _rebuild() -> void:
	if not is_inside_tree():
		return
	if _shape == null:
		_shape = CollisionShape3D.new()
		add_child(_shape, false, Node.INTERNAL_MODE_FRONT)
		_multimesh = MultiMeshInstance3D.new()
		_multimesh.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		add_child(_multimesh, false, Node.INTERNAL_MODE_FRONT)
	var box := BoxShape3D.new()
	box.size = size
	_shape.shape = box
	_shape.position.y = size.y * 0.5

	var quad := QuadMesh.new()
	quad.size = Vector2(0.7, size.y)
	quad.center_offset = Vector3(0.0, size.y * 0.5, 0.0)
	var mm := MultiMesh.new()
	mm.transform_format = MultiMesh.TRANSFORM_3D
	mm.mesh = quad
	var count := int(size.x * size.z * density)
	mm.instance_count = count * 2  # каждый пучок — два скрещённых квада
	var rng := RandomNumberGenerator.new()
	rng.seed = 12345  # одинаковая трава при каждом запуске
	for i in count:
		var pos := Vector3(rng.randf_range(-0.5, 0.5) * size.x, 0.0, rng.randf_range(-0.5, 0.5) * size.z)
		var angle := rng.randf() * PI
		var height := rng.randf_range(0.7, 1.15)
		for k in 2:
			var rot := Basis(Vector3.UP, angle + k * PI * 0.5).scaled(Vector3(1.0, height, 1.0))
			mm.set_instance_transform(i * 2 + k, Transform3D(rot, pos))
	_multimesh.multimesh = mm
	_multimesh.material_override = material
