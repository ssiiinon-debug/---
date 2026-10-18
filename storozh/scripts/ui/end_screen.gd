# Экран смерти и экран рассвета.
# На экране смерти всегда написано, ПОЧЕМУ Сторож нашёл игрока — правило из диздока.
class_name EndScreen
extends CanvasLayer

signal retry_requested
signal menu_requested

const CATCH_TEXT := {
	&"chase": "Он догнал тебя.",
	&"seen_hiding": "Он видел, как ты спрятался.",
	&"breath": "Он услышал твоё дыхание.",
}

const CATCH_TIP := {
	&"chase": "В погоне спасает вспышка камеры или укрытие, в которое он не видел, как ты залез.",
	&"seen_hiding": "Прячься, только когда он тебя не видит: сначала оторвись, потом лезь в укрытие.",
	&"breath": "Когда он рядом с укрытием, держи Пробел и не дыши. Сердце стучит чаще — значит близко.",
}

var _root: Control
var _title: Label
var _body: Label
var _buttons: VBoxContainer


func _ready() -> void:
	layer = 15
	_root = UI.fill(Control.new())
	add_child(_root)
	var bg := UI.fill(ColorRect.new())
	bg.color = Color(0, 0, 0, 0.88)
	_root.add_child(bg)
	var center := UI.fill(CenterContainer.new())
	_root.add_child(center)
	var box := VBoxContainer.new()
	box.add_theme_constant_override("separation", 22)
	box.custom_minimum_size = Vector2(900, 0)
	center.add_child(box)
	_title = UI.label("", 64, HORIZONTAL_ALIGNMENT_CENTER, UI.ACCENT)
	box.add_child(_title)
	_body = UI.label("", 24)
	_body.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	box.add_child(_body)
	_buttons = VBoxContainer.new()
	_buttons.alignment = BoxContainer.ALIGNMENT_CENTER
	_buttons.add_theme_constant_override("separation", 12)
	box.add_child(_buttons)
	_root.visible = false


func show_death(reason: StringName, alert_source: StringName, has_checkpoint: bool) -> void:
	_title.text = "Сторож нашёл тебя"
	_title.add_theme_color_override("font_color", UI.DANGER)
	var lines := [CATCH_TEXT.get(reason, "Он поймал тебя.")]
	# Если причина и так про дыхание, второй раз про него не пишем.
	if alert_source != reason:
		lines.append("Что его привлекло: %s." % Noises.describe(alert_source))
	lines.append("")
	lines.append(CATCH_TIP.get(reason, ""))
	_body.text = "\n".join(lines)
	_set_buttons([
		["Ещё раз" + (" (с контрольной точки)" if has_checkpoint else ""), retry_requested.emit],
		["В главное меню", menu_requested.emit],
	])
	_show()


func show_victory(stats: Dictionary) -> void:
	_title.text = "Рассвет"
	_title.add_theme_color_override("font_color", UI.ACCENT)
	_body.text = "Запели птицы. Сторож ушёл обратно в землю — до следующей ночи.\n\n" + \
		"Сторож замечал тебя: %d   ·   Вспышек: %d   ·   В укрытиях: %d сек" % [
			stats.get("spotted", 0), stats.get("flashes", 0), int(stats.get("hidden", 0.0))]
	_set_buttons([
		["Пережить ночь ещё раз", retry_requested.emit],
		["В главное меню", menu_requested.emit],
	])
	_show()


func _set_buttons(items: Array) -> void:
	for c in _buttons.get_children():
		c.queue_free()
	for item: Array in items:
		var b := UI.button(item[0], item[1], 420)
		b.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
		_buttons.add_child(b)


func _show() -> void:
	_root.visible = true
	_root.modulate.a = 0.0
	create_tween().tween_property(_root, "modulate:a", 1.0, 0.8)
	Input.mouse_mode = Input.MOUSE_MODE_VISIBLE
	await get_tree().process_frame
	if _buttons.get_child_count() > 0:
		(_buttons.get_child(0) as Button).grab_focus()
