# Пауза по Esc: останавливает мир, показывает курсор и настройки.
class_name PauseMenu
extends CanvasLayer

signal restart_requested
signal menu_requested

## Пока идёт экран смерти/победы, паузу открывать нельзя.
var can_pause := true

var _root: Control
var _main: VBoxContainer
var _settings: SettingsPanel


func _ready() -> void:
	layer = 20
	process_mode = Node.PROCESS_MODE_ALWAYS
	_root = UI.fill(Control.new())
	add_child(_root)
	var dim := UI.fill(ColorRect.new())
	dim.color = Color(0, 0, 0, 0.7)
	_root.add_child(dim)

	var center := UI.fill(CenterContainer.new())
	_root.add_child(center)
	var panel := PanelContainer.new()
	center.add_child(panel)
	var stack := VBoxContainer.new()
	panel.add_child(stack)

	_main = VBoxContainer.new()
	_main.add_theme_constant_override("separation", 12)
	_main.add_child(UI.label("Пауза", 40, HORIZONTAL_ALIGNMENT_CENTER, UI.ACCENT))
	_main.add_child(UI.button("Продолжить", close))
	_main.add_child(UI.button("Настройки", func() -> void: _show_settings(true)))
	_main.add_child(UI.button("Начать ночь заново", func() -> void:
		close()
		restart_requested.emit()))
	_main.add_child(UI.button("В главное меню", func() -> void:
		close()
		menu_requested.emit()))
	stack.add_child(_main)

	_settings = SettingsPanel.new()
	_settings.closed.connect(func() -> void: _show_settings(false))
	stack.add_child(_settings)
	_show_settings(false)
	_root.visible = false


func _unhandled_input(event: InputEvent) -> void:
	if event.is_action_pressed("pause"):
		if _root.visible:
			close()
		elif can_pause:
			open()
		get_viewport().set_input_as_handled()


func open() -> void:
	_root.visible = true
	_show_settings(false)
	get_tree().paused = true
	Input.mouse_mode = Input.MOUSE_MODE_VISIBLE
	(_main.get_child(1) as Button).grab_focus()


func close() -> void:
	_root.visible = false
	get_tree().paused = false
	Input.mouse_mode = Input.MOUSE_MODE_CAPTURED


func _show_settings(on: bool) -> void:
	_main.visible = not on
	_settings.visible = on
