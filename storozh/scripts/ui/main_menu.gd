# Главное меню: в темноте иногда открываются два огонька — глаза Сторожа.
extends Control

const GAME_SCENE := "res://scenes/game.tscn"

var _menu: VBoxContainer
var _settings: SettingsPanel
var _eyes_open := 0.0
var _eyes_timer := 2.0
var _eyes_pos := Vector2(0.72, 0.42)


func _ready() -> void:
	Input.mouse_mode = Input.MOUSE_MODE_VISIBLE
	get_tree().paused = false
	AudioBus.world_root = null
	AudioBus.stop_all()
	AudioBus.set_ambience("drone_loop", -16.0)

	var left := VBoxContainer.new()
	left.add_theme_constant_override("separation", 14)
	left.position = Vector2(140, 180)
	add_child(left)

	left.add_child(UI.label("СТОРОЖ", 110, HORIZONTAL_ALIGNMENT_LEFT, UI.TEXT))
	left.add_child(UI.label("вертикальный срез · ночь в церкви", 24, HORIZONTAL_ALIGNMENT_LEFT, UI.DIM))
	var spacer := Control.new()
	spacer.custom_minimum_size = Vector2(0, 40)
	left.add_child(spacer)

	_menu = VBoxContainer.new()
	_menu.add_theme_constant_override("separation", 12)
	left.add_child(_menu)
	if GameState.has_checkpoint():
		_menu.add_child(UI.button("Продолжить ночь", _continue_night, 380))
	_menu.add_child(UI.button("Новая ночь", _new_night, 380))
	_menu.add_child(UI.button("Настройки", func() -> void: _show_settings(true), 380))
	_menu.add_child(UI.button("Выход", func() -> void: get_tree().quit(), 380))

	_settings = SettingsPanel.new()
	_settings.closed.connect(func() -> void: _show_settings(false))
	left.add_child(_settings)
	_show_settings(false)

	var controls := UI.label(
		"WASD — идти · Shift — бег · Ctrl — присесть · E — действие · F — фонарик\n" +
		"ПКМ — поднять камеру · ЛКМ — вспышка · Пробел в укрытии — не дышать · Esc — пауза",
		18, HORIZONTAL_ALIGNMENT_LEFT, UI.DIM)
	controls.position = Vector2(140, 700)
	add_child(controls)

	(_menu.get_child(0) as Button).grab_focus()


func _process(delta: float) -> void:
	# Глаза открываются на пару секунд в случайном месте темноты.
	_eyes_timer -= delta
	if _eyes_timer <= 0.0:
		if _eyes_open > 0.5:
			_eyes_open = 0.0
			_eyes_timer = randf_range(3.0, 7.0)
			_eyes_pos = Vector2(randf_range(0.55, 0.9), randf_range(0.25, 0.7))
		else:
			_eyes_open = 1.0
			_eyes_timer = randf_range(1.5, 3.5)
	queue_redraw()


func _draw() -> void:
	# Фон рисуем здесь же, а не отдельным ColorRect: свой _draw идёт под детьми.
	draw_rect(Rect2(Vector2.ZERO, size), Color(0.01, 0.012, 0.018))
	if _eyes_open < 0.5:
		return
	var p := _eyes_pos * size
	var glow := Color(1.0, 0.93, 0.62, 0.9)
	draw_circle(p, 4.0, glow)
	draw_circle(p + Vector2(26, 0), 4.0, glow)
	draw_circle(p, 10.0, Color(glow, 0.08))
	draw_circle(p + Vector2(26, 0), 10.0, Color(glow, 0.08))


func _new_night() -> void:
	GameState.clear_checkpoint()
	get_tree().change_scene_to_file(GAME_SCENE)


func _continue_night() -> void:
	get_tree().change_scene_to_file(GAME_SCENE)


func _show_settings(on: bool) -> void:
	_menu.visible = not on
	_settings.visible = on
