# Настройки: чувствительность мыши, инверсия, пикселизация, громкость.
# Меняются сразу и сохраняются в user://save.json.
class_name SettingsPanel
extends VBoxContainer

signal closed


func _ready() -> void:
	add_theme_constant_override("separation", 14)
	add_child(UI.label("Настройки", 34, HORIZONTAL_ALIGNMENT_CENTER, UI.ACCENT))

	_add_slider("Чувствительность мыши", 0.2, 3.0, 0.05, GameState.mouse_sensitivity,
			func(v: float) -> void: GameState.mouse_sensitivity = v)
	_add_slider("Пикселизация (2 — чётче, 4 — грубее)", 2, 4, 1, GameState.pixel_scale,
			func(v: float) -> void: GameState.pixel_scale = int(v))
	_add_slider("Громкость", 0.0, 1.0, 0.05, GameState.master_volume,
			func(v: float) -> void: GameState.master_volume = v)

	var invert := CheckBox.new()
	invert.text = "Инвертировать мышь по вертикали"
	invert.button_pressed = GameState.invert_y
	invert.toggled.connect(func(on: bool) -> void:
		GameState.invert_y = on
		_changed())
	add_child(invert)

	var back := UI.button("Назад", func() -> void: closed.emit())
	back.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
	add_child(back)


func _add_slider(title: String, min_v: float, max_v: float, step: float, value: float,
		setter: Callable) -> void:
	var row := VBoxContainer.new()
	var caption := UI.label("", 20, HORIZONTAL_ALIGNMENT_LEFT, UI.DIM)
	row.add_child(caption)
	var slider := HSlider.new()
	slider.min_value = min_v
	slider.max_value = max_v
	slider.step = step
	slider.value = value
	slider.custom_minimum_size = Vector2(460, 24)
	var update_caption := func(v: float) -> void:
		caption.text = "%s: %s" % [title, str(snappedf(v, step))]
	update_caption.call(value)
	slider.value_changed.connect(func(v: float) -> void:
		setter.call(v)
		update_caption.call(v)
		_changed())
	row.add_child(slider)
	add_child(row)


func _changed() -> void:
	GameState.apply_settings()
	GameState.save_game()
