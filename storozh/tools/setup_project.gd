# Одноразовый скрипт настройки проекта: управление, аудиошины, тема интерфейса.
# Всё это можно делать руками в редакторе, но так настройки точно совпадут с кодом.
#
# Запуск (из папки storozh):
#   godot --headless --path . --script res://tools/setup_project.gd
#
# Перезаписывает раздел [input] в project.godot, default_bus_layout.tres
# и scenes/ui/theme.tres. Если правил их в редакторе — правки пропадут.
extends SceneTree


func _init() -> void:
	_setup_input()
	_setup_buses()
	_setup_theme()
	ProjectSettings.set_setting("gui/theme/custom", "res://scenes/ui/theme.tres")
	var err := ProjectSettings.save()
	print("project.godot saved: ", error_string(err))
	quit()


# --- Управление -------------------------------------------------------------

func _key(physical: Key) -> InputEventKey:
	# physical_keycode = клавиша по месту на клавиатуре, а не по букве.
	# Так WASD работает и на русской раскладке (ЦФЫВ).
	var e := InputEventKey.new()
	e.physical_keycode = physical
	return e


func _mouse(button: MouseButton) -> InputEventMouseButton:
	var e := InputEventMouseButton.new()
	e.button_index = button
	return e


func _joy_button(button: JoyButton) -> InputEventJoypadButton:
	var e := InputEventJoypadButton.new()
	e.device = -1 # любой геймпад, а не только первый
	e.button_index = button
	return e


func _joy_axis(axis: JoyAxis, value: float) -> InputEventJoypadMotion:
	var e := InputEventJoypadMotion.new()
	e.device = -1
	e.axis = axis
	e.axis_value = value
	return e


func _setup_input() -> void:
	var actions := {
		"move_forward": [_key(KEY_W), _key(KEY_UP), _joy_axis(JOY_AXIS_LEFT_Y, -1.0)],
		"move_back": [_key(KEY_S), _key(KEY_DOWN), _joy_axis(JOY_AXIS_LEFT_Y, 1.0)],
		"move_left": [_key(KEY_A), _key(KEY_LEFT), _joy_axis(JOY_AXIS_LEFT_X, -1.0)],
		"move_right": [_key(KEY_D), _key(KEY_RIGHT), _joy_axis(JOY_AXIS_LEFT_X, 1.0)],
		"look_left": [_joy_axis(JOY_AXIS_RIGHT_X, -1.0)],
		"look_right": [_joy_axis(JOY_AXIS_RIGHT_X, 1.0)],
		"look_up": [_joy_axis(JOY_AXIS_RIGHT_Y, -1.0)],
		"look_down": [_joy_axis(JOY_AXIS_RIGHT_Y, 1.0)],
		"sprint": [_key(KEY_SHIFT), _joy_button(JOY_BUTTON_LEFT_STICK)],
		"crouch": [_key(KEY_CTRL), _key(KEY_C), _joy_button(JOY_BUTTON_RIGHT_STICK)],
		"interact": [_key(KEY_E), _joy_button(JOY_BUTTON_A)],
		"flashlight": [_key(KEY_F), _joy_button(JOY_BUTTON_Y)],
		"camera_aim": [_mouse(MOUSE_BUTTON_RIGHT), _joy_axis(JOY_AXIS_TRIGGER_LEFT, 1.0)],
		"flash": [_mouse(MOUSE_BUTTON_LEFT), _joy_axis(JOY_AXIS_TRIGGER_RIGHT, 1.0)],
		"notebook": [_key(KEY_TAB), _joy_button(JOY_BUTTON_BACK)],
		"hold_breath": [_key(KEY_SPACE), _joy_button(JOY_BUTTON_X)],
		"pause": [_key(KEY_ESCAPE), _joy_button(JOY_BUTTON_START)],
		"debug_skip_hour": [_key(KEY_F5)],
		"debug_overlay": [_key(KEY_F3)],
	}
	for action: String in actions:
		var deadzone := 0.2 if action.begins_with("look_") or action.begins_with("move_") else 0.5
		ProjectSettings.set_setting("input/" + action, {
			"deadzone": deadzone,
			"events": actions[action],
		})


# --- Аудиошины --------------------------------------------------------------
# Master <- SFX <- Church (эхо в церкви), Master <- Ambience (гул и музыка).

func _setup_buses() -> void:
	while AudioServer.bus_count > 1:
		AudioServer.remove_bus(1)

	AudioServer.add_bus(1)
	AudioServer.set_bus_name(1, "SFX")
	AudioServer.set_bus_send(1, "Master")

	AudioServer.add_bus(2)
	AudioServer.set_bus_name(2, "Ambience")
	AudioServer.set_bus_send(2, "Master")

	# Сюда звуки попадают через Area3D с reverb_bus_enabled (зона внутри церкви).
	# Сухой сигнал идёт своим путём, поэтому тут только «хвост» эха.
	AudioServer.add_bus(3)
	AudioServer.set_bus_name(3, "Church")
	AudioServer.set_bus_send(3, "SFX")
	var reverb := AudioEffectReverb.new()
	reverb.room_size = 0.75
	reverb.damping = 0.35
	reverb.spread = 0.8
	reverb.dry = 0.0
	reverb.wet = 0.7
	reverb.predelay_msec = 40.0
	AudioServer.add_bus_effect(3, reverb)

	var err := ResourceSaver.save(AudioServer.generate_bus_layout(), "res://default_bus_layout.tres")
	print("bus layout saved: ", error_string(err))


# --- Тема интерфейса --------------------------------------------------------

func _box(bg: Color, border: Color, border_width := 1) -> StyleBoxFlat:
	var s := StyleBoxFlat.new()
	s.bg_color = bg
	s.border_color = border
	s.set_border_width_all(border_width)
	s.set_content_margin_all(10)
	s.content_margin_left = 18
	s.content_margin_right = 18
	return s


func _setup_theme() -> void:
	var t := Theme.new()
	t.default_font_size = 22

	var text := Color("d8d2c4")
	var dim := Color("8a8478")
	var accent := Color("e8d9a8")

	t.set_color("font_color", "Label", text)
	t.set_color("font_shadow_color", "Label", Color(0, 0, 0, 0.8))
	t.set_constant("shadow_offset_x", "Label", 2)
	t.set_constant("shadow_offset_y", "Label", 2)

	t.set_stylebox("normal", "Button", _box(Color(0.06, 0.06, 0.07, 0.85), Color("3a3833")))
	t.set_stylebox("hover", "Button", _box(Color(0.12, 0.11, 0.1, 0.95), accent))
	t.set_stylebox("pressed", "Button", _box(Color(0.2, 0.18, 0.14, 1.0), accent))
	t.set_stylebox("focus", "Button", _box(Color(0, 0, 0, 0), accent, 2))
	t.set_color("font_color", "Button", text)
	t.set_color("font_hover_color", "Button", accent)
	t.set_color("font_pressed_color", "Button", accent)
	t.set_color("font_focus_color", "Button", accent)
	t.set_color("font_disabled_color", "Button", dim)

	var panel := _box(Color(0.03, 0.03, 0.04, 0.92), Color("3a3833"))
	panel.set_content_margin_all(28)
	t.set_stylebox("panel", "PanelContainer", panel)
	t.set_stylebox("panel", "Panel", panel)

	t.set_color("font_color", "CheckBox", text)
	t.set_color("font_hover_color", "CheckBox", accent)

	var err := ResourceSaver.save(t, "res://scenes/ui/theme.tres")
	print("theme saved: ", error_string(err))
