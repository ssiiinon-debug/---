# Базовый класс всего, с чем можно взаимодействовать по E: предметы, укрытия, двери.
# Это Area3D на слое interact, игрок находит её лучом из камеры.
#
# Своё взаимодействие: наследуйся и переопредели get_prompt() и interact().
class_name Interactable
extends Area3D

const LAYER_INTERACT := 1 << 3

## Текст подсказки, игрок увидит «[E] <prompt>».
@export var prompt := "Осмотреть"
@export var enabled := true


func _ready() -> void:
	collision_layer = LAYER_INTERACT
	collision_mask = 0
	monitoring = false


func get_prompt(_player: Player) -> String:
	return prompt


func can_interact(_player: Player) -> bool:
	return enabled


func interact(_player: Player) -> void:
	pass
