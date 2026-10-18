# Предмет, который можно подобрать: батарейка для фонарика или заряд вспышки.
class_name Pickup
extends Interactable

enum Kind { BATTERY, FLASH_CHARGE }

@export var kind := Kind.BATTERY
## Уникальный id для контрольных точек: подобранное не появится снова после смерти.
@export var pickup_id := ""


func _ready() -> void:
	super()
	if GameState.is_picked(pickup_id):
		queue_free()


func get_prompt(_player: Player) -> String:
	match kind:
		Kind.BATTERY:
			return "Взять батарейку"
		Kind.FLASH_CHARGE:
			return "Взять аккумулятор для вспышки"
	return prompt


func interact(player: Player) -> void:
	player.collect(self)
	AudioBus.play_3d(AudioBus.get_stream("pickup"), global_position, -4.0)
	queue_free()
