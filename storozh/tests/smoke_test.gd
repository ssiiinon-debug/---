# Автотест вертикального среза: сам играет короткие сценарии и проверяет,
# что Сторож и игрок ведут себя по диздоку. Рендер не нужен.
#
#   godot --headless --path . --fixed-fps 60 res://tests/smoke_test.tscn
#
# --fixed-fps 60 крутит физику с постоянным шагом и быстрее реального времени.
# Это сцена, а не --script: так автозагрузки (GameState, Noises…) уже готовы к старту теста.
extends Node

const GAME := "res://scenes/game.tscn"

var game: Node
var level: NightLevel
var player: Player
var storozh: Storozh
var passed := 0
var failed := 0
var noises: Array = []


func _ready() -> void:
	_run.call_deferred()


func _run() -> void:
	GameState.clear_checkpoint()
	Noises.emitted.connect(func(pos: Vector3, r: float, src: StringName) -> void: noises.append([pos, r, src]))

	await _load_game()
	await _test_navigation()
	await _test_movement()
	await _test_pickup()
	await _test_creaky_board()
	await _test_investigate_and_search()
	await _test_chase_and_flash()
	await _test_door_slam()
	await _test_seen_hiding()

	await _load_game()
	await _test_breath_found()

	await _load_game()
	await _test_hold_breath()

	await _load_game()
	await _test_checkpoint()

	await _load_game()
	await _test_dawn()
	await _test_pause()

	print("\n==== %d passed, %d failed ====" % [passed, failed])
	GameState.clear_checkpoint()
	get_tree().quit(1 if failed > 0 else 0)


# --- Помощники -----------------------------------------------------------------

func check(cond: bool, what: String) -> void:
	if cond:
		passed += 1
		print("  ok   ", what)
	else:
		failed += 1
		print("  FAIL ", what)


func frames(n: int) -> void:
	for i in n:
		await get_tree().physics_frame


func seconds(t: float) -> void:
	await frames(int(t * 60.0))


## Ждать, пока условие станет истинным (не дольше timeout секунд).
func wait_until(cond: Callable, timeout: float) -> bool:
	var n := int(timeout * 60.0)
	for i in n:
		if cond.call():
			return true
		await get_tree().physics_frame
	return cond.call()


func _load_game() -> void:
	if game:
		game.queue_free()
		await frames(2)
	get_tree().paused = false
	game = load(GAME).instantiate()
	add_child(game)
	level = game.level
	player = game.player
	storozh = game.storozh
	# Сценарий начала ночи в тестах не нужен — управляем всем сами.
	game._script_events.clear()
	await frames(10)


func put_player(pos: Vector3, look_at_pos = null) -> void:
	player.global_position = pos
	player.velocity = Vector3.ZERO
	if look_at_pos != null:
		var dir: Vector3 = look_at_pos - player.get_eye_position()
		player._yaw = atan2(-dir.x, -dir.z)
		player._pitch = atan2(dir.y, Vector2(dir.x, dir.z).length())
		player._apply_view()


func put_storozh(pos: Vector3, face_pos = null) -> void:
	storozh.global_position = pos
	storozh.velocity = Vector3.ZERO
	if face_pos != null:
		var dir: Vector3 = face_pos - pos
		storozh.rotation.y = atan2(-dir.x, -dir.z)


func reset_storozh() -> void:
	storozh.wake()
	storozh._set_state(Storozh.State.WANDER)
	storozh._since_seen = INF
	storozh.remembered_spot = null
	storozh._next_patrol_point()


# --- Тесты -----------------------------------------------------------------------

func _test_navigation() -> void:
	print("Навигация")
	var map := level.get_world_3d().navigation_map
	await wait_until(func() -> bool: return NavigationServer3D.map_get_iteration_id(map) > 0, 2.0)
	var routes := {
		"подпол -> неф": [Vector3(-2.6, -3, -1.5), Vector3(0, 0, 2)],
		"неф -> алтарь (царские врата)": [Vector3(0, 0, 2), Vector3(1.5, 0.08, -9.5)],
		"алтарь -> двор (задняя дверь)": [Vector3(1.5, 0.08, -9.5), Vector3(9, 0, -2)],
		"неф -> погост (главный вход)": [Vector3(0, 0, 2), Vector3(0, 0, -17)],
		"подпол -> УАЗ": [Vector3(-3.0, -3, 5.0), Vector3(6.5, 0, 12.5)],
	}
	for name: String in routes:
		var a: Vector3 = routes[name][0]
		var b: Vector3 = routes[name][1]
		var path := NavigationServer3D.map_get_path(map, a, b, true)
		var ok := path.size() > 1 and path[path.size() - 1].distance_to(b) < 0.6
		check(ok, "путь %s (%d точек)" % [name, path.size()])


func _test_movement() -> void:
	print("Игрок")
	put_player(Vector3(0, 0.1, 4.5), Vector3(0, 1.6, 0))
	await frames(10)
	var start := player.global_position
	Input.action_press("move_forward")
	await seconds(1.0)
	Input.action_release("move_forward")
	var moved := player.global_position.distance_to(start)
	check(moved > 1.8 and moved < 3.2, "идёт шагом ~2.6 м/с (прошёл %.2f м за 1 с)" % moved)

	start = player.global_position
	Input.action_press("move_back")
	Input.action_press("sprint")
	await seconds(1.0)
	Input.action_release("move_back")
	Input.action_release("sprint")
	moved = player.global_position.distance_to(start)
	check(moved > 3.5, "бежит быстрее (%.2f м за 1 с)" % moved)
	check(player.stamina < player.stamina_max, "бег тратит выносливость")

	Input.action_press("crouch")
	await seconds(0.6)
	check(player.crouching and player.head.position.y < 1.2, "присед опускает камеру")
	Input.action_release("crouch")
	await seconds(0.6)
	check(not player.crouching, "встаёт обратно")

	player.battery = 1.0
	player.toggle_flashlight()
	await seconds(1.0)
	check(player.light_on and player.flashlight.visible, "фонарик включается")
	check(player.battery < 1.0, "фонарик тратит батарейку")
	player.toggle_flashlight()


func _test_pickup() -> void:
	print("Предметы")
	var battery: Pickup = level.get_node("Pickups/BatteryAltar")
	player.battery = 0.3
	battery.interact(player)
	await frames(2)
	check(is_equal_approx(player.battery, 0.9), "батарейка заряжает фонарик (%.2f)" % player.battery)
	check("church_battery_altar" in player.picked_ids, "подобранное запоминается для контрольной точки")
	var charges := player.flash_charges
	(level.get_node("Pickups/FlashBackpack") as Pickup).interact(player)
	check(player.flash_charges == charges + 1, "аккумулятор добавляет заряд вспышки")


func _test_creaky_board() -> void:
	print("Скрипучие половицы")
	put_player(Vector3(0, 0.05, 1.2))
	await frames(6)
	check(player.creaky_boards > 0, "игрок стоит на скрипучих досках")
	noises.clear()
	player._footstep()
	var creak := noises.filter(func(n: Array) -> bool: return n[2] == &"creak")
	check(not creak.is_empty() and creak[0][1] >= 9.0, "шаг по ним — громкий скрип")
	noises.clear()
	player.crouching = true
	player._footstep()
	check(noises.size() == 1 and noises[0][2] == &"walk" and noises[0][1] < 1.0, "присев — почти бесшумно")
	player.crouching = false
	put_player(Vector3(3, 0.05, -2.0))
	await frames(6)


func _test_investigate_and_search() -> void:
	print("Бродит -> Проверяет шум -> Ищет рядом")
	put_player(Vector3(20, 0.1, 20))
	put_storozh(Vector3(0, 0.05, -3.0), Vector3(0, 0, -10))
	# Скрип половиц в прошлом тесте мог его уже разбудить — это нормально, но начнём с чистого листа.
	reset_storozh()
	await seconds(0.5)
	check(storozh.state == Storozh.State.WANDER, "проснулся и бродит")
	Noises.make(Vector3(0, 0, 6.0), 12.0, &"run")
	await frames(2)
	check(storozh.state == Storozh.State.INVESTIGATE, "услышал топот и пошёл проверять")
	check(storozh.alert_source == &"run", "запомнил, что его привлекло")
	var arrived := await wait_until(func() -> bool: return storozh.state == Storozh.State.SEARCH, 15.0)
	check(arrived, "дошёл до места, никого — ищет рядом")
	check(storozh.global_position.distance_to(Vector3(0, 0, 6)) < 3.0, "ищет именно там, где шумели")
	Noises.make(Vector3(0, 0, -20.0), 3.0, &"walk")
	await frames(2)
	check(storozh.state == Storozh.State.SEARCH, "тихий шум далеко не слышит")


func _test_chase_and_flash() -> void:
	print("Погоня и вспышка")
	put_storozh(Vector3(0, 0.05, -2.0), Vector3(0, 0, 4))
	await frames(2)
	put_player(Vector3(0, 0.05, 3.0), storozh.get_eyes_position())
	var chased := await wait_until(func() -> bool: return storozh.state == Storozh.State.CHASE, 1.0)
	check(chased, "видит игрока в 5 м — погоня")
	player.flash_charges = 2
	put_player(player.global_position, storozh.get_eyes_position())
	player.fire_flash()
	await frames(2)
	check(storozh.state == Storozh.State.BLINDED, "вспышка ослепляет")
	check(player.flash_charges == 1, "вспышка тратит заряд")
	# Уходим из поля зрения, пока он ослеплён.
	put_player(Vector3(20, 0.1, 20))
	var woke := await wait_until(func() -> bool: return storozh.state == Storozh.State.SEARCH, 4.0)
	check(woke, "очнулся — ищет рядом")


func _test_door_slam() -> void:
	print("Двери")
	var door: Door = level.get_node("Doors/MainDoor")
	check(not door.is_open, "главная дверь закрыта")
	put_storozh(Vector3(0, 0.05, 10.6), Vector3(0, 0, 0))
	var opened := await wait_until(func() -> bool: return door.is_open, 1.0)
	check(opened, "Сторож подошёл — дверь распахнулась")
	put_storozh(Vector3(0, 0.05, 0.0))
	await frames(4)


func _test_seen_hiding() -> void:
	print("Спрятался у него на глазах")
	var bench: HidingSpot = level.get_node("NavigationRegion3D/Furniture/BenchE1")
	put_storozh(Vector3(0, 0.05, -2.5), Vector3(4, 0, -2.5))
	await frames(2)
	put_player(bench.exit_point.global_position + Vector3(0, 0.05, 0), storozh.get_eyes_position())
	var chased := await wait_until(func() -> bool: return storozh.state == Storozh.State.CHASE, 1.0)
	check(chased, "погоня началась")
	bench.interact(player)
	await frames(2)
	check(player.is_hidden(), "игрок под лавкой")
	check(storozh.remembered_spot == bench, "Сторож запомнил укрытие")
	var caught := await wait_until(func() -> bool: return player.dead, 6.0)
	check(caught, "вытащил игрока из укрытия")
	check(storozh.catch_reason == &"seen_hiding", "причина: видел, как ты спрятался")
	var shown := await wait_until(func() -> bool: return game.end_screen._root.visible, 5.0)
	check(shown, "экран смерти показан")
	check(game.end_screen._body.text.contains("видел, как ты спрятался"), "на экране написана причина")


func _test_breath_found() -> void:
	print("Услышал дыхание")
	var bench: HidingSpot = level.get_node("NavigationRegion3D/Furniture/BenchW2")
	put_player(bench.exit_point.global_position + Vector3(0, 0.05, 0))
	await frames(2)
	bench.interact(player)
	await seconds(0.6)
	check(player.is_hidden(), "игрок под лавкой, Сторож ничего не видел")
	storozh.wake()
	put_storozh(bench.exit_point.global_position + Vector3(0.8, 0.05, 0.6), bench.global_position)
	var caught := await wait_until(func() -> bool: return player.dead, 4.0)
	check(caught, "дышал рядом со Сторожем — нашёл")
	check(storozh.catch_reason == &"breath", "причина: услышал дыхание")


func _test_hold_breath() -> void:
	print("Задержал дыхание")
	var spot: HidingSpot = level.get_node("NavigationRegion3D/Furniture/WardrobeAltar")
	put_player(spot.exit_point.global_position + Vector3(0, 0.1, 0))
	await frames(2)
	spot.interact(player)
	await seconds(0.6)
	check(player.is_hidden(), "игрок в шкафу")
	Input.action_press("hold_breath")
	await frames(2)
	storozh.wake()
	put_storozh(spot.exit_point.global_position + Vector3(0.5, 0.05, 0.4))
	await seconds(4.0)
	check(not player.dead, "не дышит — Сторож стоит рядом и не находит")
	check(player.breath < player.breath_hold_max, "дыхание тратится")
	await seconds(4.0)
	Input.action_release("hold_breath")
	check(player._breath_lock > 0.0 or player.dead, "воздух кончился — судорожный вдох")
	var caught := await wait_until(func() -> bool: return player.dead, 4.0)
	check(caught, "после вдоха он рядом услышал")


func _test_checkpoint() -> void:
	print("Контрольная точка")
	game.night_time = 200.0
	player.battery = 0.42
	player.flash_charges = 3
	game._save_checkpoint()
	check(GameState.has_checkpoint(), "сохранилась")
	await _load_game()
	check(absf(game.night_time - 200.0) < 1.0, "ночь продолжается с того же часа")
	check(is_equal_approx(player.battery, 0.42), "заряд фонаря восстановлен")
	check(player.flash_charges == 3, "заряды вспышки восстановлены")
	check(storozh.state != Storozh.State.DORMANT, "Сторож уже не спит")
	check(storozh.global_position.distance_to(player.global_position) > 10.0, "и стоит далеко от игрока")
	GameState.clear_checkpoint()


func _test_dawn() -> void:
	print("Рассвет")
	put_player(Vector3(20, 0.1, 20))
	storozh.wake()
	var sky_before: Color = level.world_env.environment.background_color
	game.night_time = game.night_duration * 0.97
	await seconds(0.5)
	check(level.world_env.environment.background_color.get_luminance() > sky_before.get_luminance() + 0.1,
			"небо посветлело")
	game.night_time = game.night_duration - 0.2
	var won := await wait_until(func() -> bool: return not game.running, 2.0)
	check(won, "наступил рассвет")
	check(storozh.state == Storozh.State.DORMANT, "Сторож уходит в землю")
	var shown := await wait_until(func() -> bool: return game.end_screen._root.visible, 8.0)
	check(shown, "экран рассвета показан")
	check(not GameState.has_checkpoint(), "контрольная точка стёрта")


func _test_pause() -> void:
	print("Пауза")
	var esc := InputEventAction.new()
	esc.action = "pause"
	esc.pressed = true
	game.pause_menu.can_pause = true
	Input.parse_input_event(esc)
	await get_tree().process_frame
	await get_tree().process_frame
	check(get_tree().paused, "Esc ставит игру на паузу")
	Input.parse_input_event(esc)
	await get_tree().process_frame
	await get_tree().process_frame
	check(not get_tree().paused, "второй Esc снимает паузу")
