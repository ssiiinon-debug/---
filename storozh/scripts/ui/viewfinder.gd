# Видоискатель старой камеры Кости: уголки рамки, мигающий REC и заряды вспышки.
extends Control

var charges := 0
var _t := 0.0


func _process(delta: float) -> void:
	if visible:
		_t += delta
		queue_redraw()


func _draw() -> void:
	var r := Rect2(Vector2.ZERO, size).grow(-60.0)
	var arm := 48.0
	var c := Color(0.92, 0.9, 0.82, 0.8)
	var w := 3.0
	for corner in [r.position, Vector2(r.end.x, r.position.y), r.end, Vector2(r.position.x, r.end.y)]:
		var dx := arm if corner.x < size.x * 0.5 else -arm
		var dy := arm if corner.y < size.y * 0.5 else -arm
		draw_line(corner, corner + Vector2(dx, 0), c, w)
		draw_line(corner, corner + Vector2(0, dy), c, w)
	var center := size * 0.5
	draw_line(center - Vector2(14, 0), center + Vector2(14, 0), c, 2.0)
	draw_line(center - Vector2(0, 14), center + Vector2(0, 14), c, 2.0)

	var font := get_theme_default_font()
	if fmod(_t, 1.0) < 0.6:
		draw_circle(r.position + Vector2(30, 34), 8.0, Color(0.85, 0.15, 0.1))
	draw_string(font, r.position + Vector2(46, 42), "REC", HORIZONTAL_ALIGNMENT_LEFT, -1, 24, c)
	var text := "ВСПЫШКА: %d" % charges
	draw_string(font, Vector2(r.end.x - 230, r.position.y + 42), text, HORIZONTAL_ALIGNMENT_LEFT, -1, 22,
			c if charges > 0 else UI.DANGER)
