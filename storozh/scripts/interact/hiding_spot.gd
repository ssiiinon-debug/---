# Укрытие: под лавкой, в шкафу и т.п.
# Нужны два дочерних Marker3D:
#   ViewPoint — откуда смотрит камера в укрытии (смотрит по своей оси -Z),
#   ExitPoint — куда игрок вылезает (на полу).
class_name HidingSpot
extends Interactable

@export var hide_prompt := "Спрятаться"
## Насколько можно крутить головой в укрытии (градусы от направления ViewPoint).
@export var look_yaw_limit := 55.0
@export var look_pitch_limit := 30.0

@onready var view_point: Marker3D = $ViewPoint
@onready var exit_point: Marker3D = $ExitPoint

var occupant: Player = null


func _ready() -> void:
	super()
	add_to_group(&"hiding_spots")


func get_prompt(_player: Player) -> String:
	return hide_prompt


func can_interact(_player: Player) -> bool:
	return enabled and occupant == null


func interact(player: Player) -> void:
	player.enter_hiding(self)
