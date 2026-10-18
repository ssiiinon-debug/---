# HUD: минимум на экране, как просит диздок — часов нет, время читается по небу.
# Видно только то, что нужно прямо сейчас: подсказка взаимодействия, дыхание в укрытии,
# заряд фонаря (когда включаешь или он садится), видоискатель камеры.
class_name Hud
extends CanvasLayer

const ViewfinderScript := preload("res://scripts/ui/viewfinder.gd")

var _crosshair: ColorRect
var _prompt: Label
var _hint: Label
var _message: Label
var _breath_box: VBoxContainer
var _breath_bar: ProgressBar
var _breath_label: Label
var _stamina_bar: ProgressBar
var _battery: Label
var _checkpoint: Label
var _debug: Label
var _viewfinder: Control
var _fade: ColorRect

var _hint_time := 0.0
var _message_time := 0.0
var _battery_time := 0.0
var _checkpoint_time := 0.0
var _last_light := false
var _debug_visible := false


func _ready() -> void:
	layer = 5
	var root := UI.fill(Control.new())
	root.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(root)

	_viewfinder = UI.fill(Control.new())
	_viewfinder.set_script(ViewfinderScript)
	_viewfinder.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_viewfinder.visible = false
	root.add_child(_viewfinder)

	_crosshair = ColorRect.new()
	_crosshair.color = Color(1, 1, 1, 0.35)
	UI.place(_crosshair, Vector2(0.5, 0.5), Vector2.ZERO, Vector2(4, 4))
	root.add_child(_crosshair)

	_prompt = UI.place(UI.label("", 24), Vector2(0.5, 0.5), Vector2(0, 70), Vector2(900, 40))
	root.add_child(_prompt)

	_hint = UI.place(UI.label("", 26), Vector2(0.5, 1.0), Vector2(0, -150), Vector2(1300, 80))
	_hint.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	_hint.modulate.a = 0.0
	root.add_child(_hint)

	_message = UI.place(UI.label("", 20, HORIZONTAL_ALIGNMENT_CENTER, UI.ACCENT),
			Vector2(0.5, 1.0), Vector2(0, -210), Vector2(900, 34))
	_message.modulate.a = 0.0
	root.add_child(_message)

	_breath_box = VBoxContainer.new()
	UI.place(_breath_box, Vector2(0.5, 1.0), Vector2(0, -80), Vector2(360, 50))
	_breath_label = UI.label("[Пробел] задержать дыхание", 18, HORIZONTAL_ALIGNMENT_CENTER, UI.DIM)
	_breath_box.add_child(_breath_label)
	_breath_bar = UI.bar(Color(0.75, 0.78, 0.8), 6)
	_breath_box.add_child(_breath_bar)
	_breath_box.visible = false
	root.add_child(_breath_box)

	_stamina_bar = UI.bar(Color(0.7, 0.65, 0.55, 0.8), 4)
	UI.place(_stamina_bar, Vector2(0.5, 1.0), Vector2(0, -40), Vector2(240, 4))
	root.add_child(_stamina_bar)

	_battery = UI.place(UI.label("", 20, HORIZONTAL_ALIGNMENT_RIGHT, UI.DIM),
			Vector2(1.0, 1.0), Vector2(-170, -40), Vector2(300, 30))
	root.add_child(_battery)

	_checkpoint = UI.place(UI.label("контрольная точка", 18, HORIZONTAL_ALIGNMENT_RIGHT, UI.DIM),
			Vector2(1.0, 0.0), Vector2(-170, 40), Vector2(300, 30))
	_checkpoint.modulate.a = 0.0
	root.add_child(_checkpoint)

	_debug = UI.label("", 18, HORIZONTAL_ALIGNMENT_LEFT, Color(0.6, 1.0, 0.6))
	_debug.position = Vector2(16, 12)
	_debug.visible = false
	root.add_child(_debug)

	_fade = UI.fill(ColorRect.new())
	_fade.color = Color(0, 0, 0, 0)
	_fade.mouse_filter = Control.MOUSE_FILTER_IGNORE
	root.add_child(_fade)


func _process(delta: float) -> void:
	_hint_time -= delta
	_message_time -= delta
	_battery_time -= delta
	_checkpoint_time -= delta
	_hint.modulate.a = move_toward(_hint.modulate.a, 1.0 if _hint_time > 0.0 else 0.0, delta * 2.0)
	_message.modulate.a = move_toward(_message.modulate.a, 1.0 if _message_time > 0.0 else 0.0, delta * 3.0)
	_checkpoint.modulate.a = move_toward(_checkpoint.modulate.a, 1.0 if _checkpoint_time > 0.0 else 0.0, delta * 2.0)


## Обновить всё по состоянию игрока (зовёт game.gd каждый кадр).
func update_from(player: Player, storozh: Storozh, night_info: String) -> void:
	var prompt := player.get_focus_prompt()
	_prompt.text = "[E] " + prompt if prompt != "" else ""
	_crosshair.visible = not player.is_hidden() and not player.aiming and not player.dead
	_crosshair.color.a = 0.8 if prompt != "" else 0.3

	_breath_box.visible = player.is_hidden() and not player.dead
	_breath_bar.value = player.breath / player.breath_hold_max
	_breath_label.text = "не дышишь…" if player.holding_breath else "[Пробел] задержать дыхание"
	_breath_label.add_theme_color_override("font_color", UI.ACCENT if player.holding_breath else UI.DIM)

	var stamina := player.stamina / player.stamina_max
	_stamina_bar.value = stamina
	_stamina_bar.modulate.a = 0.0 if stamina >= 0.999 or player.dead else 0.7

	if player.light_on != _last_light:
		_last_light = player.light_on
		_battery_time = 2.5
	var low := player.battery < 0.25
	_battery.visible = (_battery_time > 0.0 or (low and player.light_on)) and not player.dead
	var cells := ceili(player.battery * 4.0)
	_battery.text = "фонарь  " + "▮".repeat(cells) + "▯".repeat(4 - cells)
	_battery.add_theme_color_override("font_color", UI.DANGER if low else UI.DIM)

	_viewfinder.visible = player.aiming and not player.dead
	_viewfinder.charges = player.flash_charges

	if _debug_visible:
		_debug.text = "Сторож: %s\n%s\nстрах %.2f  виден %d раз" % [
			storozh.get_state_name(), night_info, player.fear, storozh.times_spotted]


func show_hint(text: String, duration := 5.0) -> void:
	_hint.text = text
	_hint_time = duration


func show_message(text: String) -> void:
	_message.text = text
	_message_time = 2.5


func show_checkpoint() -> void:
	_checkpoint_time = 2.5


func toggle_debug() -> void:
	_debug_visible = not _debug_visible
	_debug.visible = _debug_visible


func fade_to(color: Color, duration: float) -> Tween:
	var t := create_tween()
	t.tween_property(_fade, "color", color, duration)
	return t
