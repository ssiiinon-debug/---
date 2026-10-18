# Снимает скриншоты ключевых ракурсов, чтобы проверить картинку без ручного прохождения.
#   godot --path . --rendering-driver opengl3 --resolution 1440x810 res://tests/screenshots.tscn
# Кадры падают в user://screenshots/ (путь печатается в консоль).
extends Node

const GAME := "res://scenes/game.tscn"

var game: Node
var level: NightLevel
var player: Player
var storozh: Storozh
var out_dir := ""


func _ready() -> void:
	out_dir = OS.get_user_data_dir().path_join("screenshots")
	DirAccess.make_dir_recursive_absolute(out_dir)
	print("screenshots -> ", out_dir)
	_run.call_deferred()


func _run() -> void:
	GameState.clear_checkpoint()
	await _load()

	# 1. Старт: неф, свеча у спальников, фонарь выключен
	await _shot("01_start_dark")
	# 2. То же с фонарём
	player.light_on = true
	await _shot("02_start_flashlight")

	# 3. Сторож в нефе в свете фонаря
	storozh.visible = true
	_put_storozh(Vector3(-1.0, 0.0, -1.5), Vector3(1.0, 0.0, 3.5))
	_put_player(Vector3(1.0, 0.0, 3.0), storozh.get_eyes_position() + Vector3(0, -0.9, 0))
	await _shot("03_storozh_flashlight")
	# 4. Он же издалека в темноте: видно только глаза
	player.light_on = false
	_put_storozh(Vector3(-2.0, 0.0, -9.0), Vector3(1.0, 0.0, 6.0))
	_put_player(Vector3(1.0, 0.0, 6.0), storozh.get_eyes_position())
	await _shot("04_storozh_eyes_far")
	# 5. Страх: он рядом (ослеплён надолго, чтобы стоял на месте и не поймал)
	storozh.wake()
	storozh.blind(999.0)
	_put_storozh(Vector3(0.6, 0.0, 3.2), Vector3(1.0, 0.0, 6.0))
	_put_player(Vector3(1.0, 0.0, 5.0), storozh.get_eyes_position())
	player.light_on = true
	await _shot("05_fear_close", 90)
	player.light_on = false
	_put_storozh(Vector3(-3.4, -3.0, -2.2))

	# 6. Подсказка у лавки
	var bench: HidingSpot = level.get_node("NavigationRegion3D/Furniture/BenchE1")
	_put_player(bench.exit_point.global_position + Vector3(-0.6, 0, 0), bench.global_position + Vector3(0, 0.3, 0))
	player.light_on = true
	await _shot("06_prompt_bench")
	# 7. Под лавкой
	bench.interact(player)
	await _shot("07_under_bench", 60)
	player.exit_hiding()
	await _frames(40)

	# 8. В шкафу (вид через щель)
	var wardrobe: HidingSpot = level.get_node("NavigationRegion3D/Furniture/WardrobeAltar")
	_put_player(wardrobe.exit_point.global_position, wardrobe.global_position)
	await _frames(5)
	wardrobe.interact(player)
	player.light_on = false
	await _shot("08_in_wardrobe", 60)
	player.exit_hiding()
	await _frames(40)

	# 9. Подпол: вид на лестницу
	_put_player(Vector3(-2.6, -3.0, -1.6), Vector3(-2.6, -1.4, 4.0))
	player.light_on = true
	await _shot("09_basement")

	# 10. Двор: силуэт церкви из тумана
	player.light_on = false
	_put_player(Vector3(4.0, 0.0, 22.0), Vector3(0.0, 4.0, 0.0))
	await _shot("10_church_from_yard")
	# 11. Погост с фонарём
	_put_player(Vector3(0.0, 0.0, -12.5), Vector3(0.0, 0.5, -19.0))
	player.light_on = true
	await _shot("11_pogost")
	# 12. Видоискатель камеры
	_put_player(Vector3(0.0, 0.0, 6.0), Vector3(0.0, 1.5, -6.0))
	player.aiming = true
	set_physics_process(true)
	Input.action_press("camera_aim")
	await _shot("12_viewfinder")
	Input.action_release("camera_aim")
	# 13. Рассвет
	player.light_on = false
	_put_player(Vector3(4.0, 0.0, 22.0), Vector3(0.0, 4.0, 0.0))
	game.night_time = game.night_duration * 0.985
	await _shot("13_dawn")
	# 14. Экран смерти
	game.night_time = 100.0
	_put_storozh(Vector3(0.0, 0.0, 15.0), Vector3(4.0, 0.0, 22.0))
	_put_player(Vector3(0.0, 0.0, 16.0), Vector3(0.0, 1.5, 15.0))
	storozh.wake()
	storozh._catch(&"breath")
	await _frames(240)
	await _shot("14_death_screen", 10)

	# 15. Главное меню
	game.queue_free()
	await _frames(2)
	var menu: Node = load("res://scenes/main_menu.tscn").instantiate()
	add_child(menu)
	menu.set("_eyes_open", 1.0)
	menu.set("_eyes_timer", 10.0)
	await _shot("15_main_menu", 10)

	print("done")
	get_tree().quit()


func _load() -> void:
	game = load(GAME).instantiate()
	add_child(game)
	level = game.level
	player = game.player
	storozh = game.storozh
	game._script_events.clear()
	Input.mouse_mode = Input.MOUSE_MODE_VISIBLE
	await _frames(20)


func _frames(n: int) -> void:
	for i in n:
		await get_tree().process_frame


func _shot(shot_name: String, wait := 30) -> void:
	await _frames(wait)
	await RenderingServer.frame_post_draw
	var img := get_viewport().get_texture().get_image()
	var path := out_dir.path_join(shot_name + ".png")
	img.save_png(path)
	print("saved ", path)


func _put_player(pos: Vector3, look_at_pos: Vector3) -> void:
	player.global_position = pos
	player.velocity = Vector3.ZERO
	var dir := look_at_pos - (pos + Vector3.UP * (player.stand_height - player.eye_offset))
	player._yaw = atan2(-dir.x, -dir.z)
	player._pitch = atan2(dir.y, Vector2(dir.x, dir.z).length())
	player._apply_view()


func _put_storozh(pos: Vector3, face_pos = null) -> void:
	storozh.global_position = pos
	storozh.velocity = Vector3.ZERO
	if face_pos != null:
		var dir: Vector3 = face_pos - pos
		storozh.rotation.y = atan2(-dir.x, -dir.z)
