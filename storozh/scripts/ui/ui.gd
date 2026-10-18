# Мелкие помощники для интерфейса, который собирается кодом.
class_name UI
extends RefCounted

const TEXT := Color("d8d2c4")
const DIM := Color("8a8478")
const ACCENT := Color("e8d9a8")
const DANGER := Color("b8473a")


static func label(text: String, size := 22, align := HORIZONTAL_ALIGNMENT_CENTER,
		color := TEXT) -> Label:
	var l := Label.new()
	l.text = text
	l.horizontal_alignment = align
	l.add_theme_font_size_override("font_size", size)
	l.add_theme_color_override("font_color", color)
	return l


static func button(text: String, on_pressed: Callable, min_width := 320) -> Button:
	var b := Button.new()
	b.text = text
	b.custom_minimum_size = Vector2(min_width, 48)
	b.pressed.connect(on_pressed)
	b.focus_mode = Control.FOCUS_ALL
	return b


static func bar(fill: Color, height := 6) -> ProgressBar:
	var p := ProgressBar.new()
	p.show_percentage = false
	p.min_value = 0.0
	p.max_value = 1.0
	p.custom_minimum_size = Vector2(0, height)
	var bg := StyleBoxFlat.new()
	bg.bg_color = Color(0, 0, 0, 0.5)
	var fg := StyleBoxFlat.new()
	fg.bg_color = fill
	p.add_theme_stylebox_override("background", bg)
	p.add_theme_stylebox_override("fill", fg)
	return p


## Растянуть контрол на весь экран.
static func fill(c: Control) -> Control:
	c.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	return c


## Поставить контрол по якорю и сдвинуть: center(…, Vector2(0.5, 1.0), Vector2(0, -120)).
static func place(c: Control, anchor: Vector2, offset: Vector2, size: Vector2) -> Control:
	c.anchor_left = anchor.x
	c.anchor_right = anchor.x
	c.anchor_top = anchor.y
	c.anchor_bottom = anchor.y
	c.offset_left = offset.x - size.x * 0.5
	c.offset_right = offset.x + size.x * 0.5
	c.offset_top = offset.y - size.y * 0.5
	c.offset_bottom = offset.y + size.y * 0.5
	return c
