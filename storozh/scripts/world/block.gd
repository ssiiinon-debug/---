# Блок для блокаута: ящик с коллизией и материалом.
# В редакторе меняешь одно поле size — меш и коллизия подстраиваются сами.
# Текстура с world_uv не растягивается, поэтому блок можно делать любого размера.
@tool
class_name Block
extends StaticBody3D

@export var size := Vector3.ONE:
	set(value):
		size = value
		_rebuild()

@export var material: Material:
	set(value):
		material = value
		_rebuild()

## Пол под этим блоком: wood / ground. Игрок выбирает по нему звук шагов.
@export var surface := &"wood"

## Отбрасывать тень (у мелких деталей лучше выключить — дешевле).
@export var cast_shadow := true:
	set(value):
		cast_shadow = value
		_rebuild()

var _mesh_instance: MeshInstance3D
var _shape: CollisionShape3D


func _ready() -> void:
	_rebuild()


func _rebuild() -> void:
	if not is_inside_tree():
		return
	if _mesh_instance == null:
		# INTERNAL — дети не сохраняются в .tscn и не мешаются в дереве сцены.
		_mesh_instance = MeshInstance3D.new()
		add_child(_mesh_instance, false, Node.INTERNAL_MODE_FRONT)
		_shape = CollisionShape3D.new()
		add_child(_shape, false, Node.INTERNAL_MODE_FRONT)
	var mesh := BoxMesh.new()
	mesh.size = size
	_mesh_instance.mesh = mesh
	_mesh_instance.material_override = material
	_mesh_instance.cast_shadow = (GeometryInstance3D.SHADOW_CASTING_SETTING_ON if cast_shadow
			else GeometryInstance3D.SHADOW_CASTING_SETTING_OFF)
	var box := BoxShape3D.new()
	box.size = size
	_shape.shape = box
