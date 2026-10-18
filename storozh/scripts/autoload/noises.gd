# Шум — главный способ, которым Сторож узнаёт об игроке.
# Любой источник (шаги, дверь, вспышка, дыхание) зовёт Noises.make(),
# а Сторож слушает сигнал emitted и сам решает, услышал или нет.
extends Node

signal emitted(position: Vector3, radius: float, source: StringName)

# Что именно привлекло Сторожа — для экрана смерти («игрок всегда понимает, почему его нашли»).
const DESCRIPTIONS := {
	&"walk": "звук шагов",
	&"run": "топот бега",
	&"creak": "скрип половиц",
	&"door": "скрип двери",
	&"click": "щелчок фонарика",
	&"flash": "щелчок вспышки",
	&"gasp": "судорожный вдох",
	&"breath": "твоё дыхание",
	&"light": "свет фонарика",
	&"sight": "ты попался ему на глаза",
	&"item": "шум от предмета",
}

## Печатать каждый шум в консоль (удобно, когда настраиваешь радиусы).
var debug_log := false


func make(position: Vector3, radius: float, source: StringName) -> void:
	if debug_log:
		print("[noise] %s r=%.1f at %s" % [source, radius, position])
	emitted.emit(position, radius, source)


func describe(source: StringName) -> String:
	return DESCRIPTIONS.get(source, String(source))
