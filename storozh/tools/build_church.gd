# Сборщик блокаута «Ночь в церкви» (глава 4, вертикальный срез).
# Собирает уровень из блоков по размерам ниже и сохраняет обычную сцену
# scenes/levels/ch4_night_church.tscn — дальше её можно править руками в редакторе.
#
# Запуск (из папки storozh):
#   godot --headless --path . --script res://tools/build_church.gd
#
# ВНИМАНИЕ: повторный запуск перезапишет сцену, ручные правки пропадут.
# Скрипт нужен, чтобы быстро перестроить блокаут целиком, пока планировка не устоялась.
#
# Система координат: Y вверх, алтарь на севере (-Z), вход на юге (+Z). Всё в метрах.
extends SceneTree

const OUT := "res://scenes/levels/ch4_night_church.tscn"

var BlockScript: Script
var LevelScript: Script

var BENCH: PackedScene
var WARDROBE: PackedScene
var DOOR: PackedScene
var BATTERY: PackedScene
var FLASH: PackedScene
var CREAKY: PackedScene
var GRASS: PackedScene
var CANDLE: PackedScene
var PLAYER: PackedScene
var STOROZH: PackedScene

var M_LOGS: Material
var M_PLANKS: Material
var M_GROUND: Material
var M_BARK: Material
var M_CRATE: Material
var M_DARK: Material
var M_ICON: Material
var M_RED: Material
var M_BLUE: Material
var M_GREEN: Material
var M_OLIVE: Material
var M_BLACK: Material
var M_FLAME: Material

# Размеры церкви (внутренние)
const IN_X := 5.0          # внутренняя полуширина
const IN_Z_N := -11.0      # северная (алтарная) стена изнутри
const IN_Z_S := 9.0        # южная (входная) стена изнутри
const WALL := 0.4
const WALL_H := 6.0
const DOOR_H := 2.8
const ICON_Z := -6.0       # иконостас
# Подпол и лаз
const BASE_Y := -3.0
const BASE_X0 := -4.6
const BASE_X1 := -0.6
const BASE_Z0 := -3.0
const BASE_Z1 := 6.0
const HOLE_X0 := -3.4
const HOLE_X1 := -1.8
const HOLE_Z0 := 0.6
const HOLE_Z1 := 4.4

var level: Node3D
var nav: NavigationRegion3D


# _initialize, а не _init: скрипты уровня ссылаются на автозагрузки (AudioBus и т.д.),
# а они появляются только после _init.
func _initialize() -> void:
	BlockScript = load("res://scripts/world/block.gd")
	LevelScript = load("res://scripts/levels/night_level.gd")
	BENCH = load("res://scenes/props/bench_hiding.tscn")
	WARDROBE = load("res://scenes/props/wardrobe_hiding.tscn")
	DOOR = load("res://scenes/props/door.tscn")
	BATTERY = load("res://scenes/props/battery.tscn")
	FLASH = load("res://scenes/props/flash_charge.tscn")
	CREAKY = load("res://scenes/props/creaky_board.tscn")
	GRASS = load("res://scenes/props/tall_grass.tscn")
	CANDLE = load("res://scenes/props/candle.tscn")
	PLAYER = load("res://scenes/player/player.tscn")
	STOROZH = load("res://scenes/enemy/storozh.tscn")
	M_LOGS = load("res://materials/logs.tres")
	M_PLANKS = load("res://materials/planks.tres")
	M_GROUND = load("res://materials/ground.tres")
	M_BARK = load("res://materials/bark.tres")
	M_CRATE = load("res://materials/crate.tres")
	M_DARK = load("res://materials/dark_wood.tres")
	M_ICON = load("res://materials/icon.tres")
	M_RED = load("res://materials/cloth_red.tres")
	M_BLUE = load("res://materials/cloth_blue.tres")
	M_GREEN = load("res://materials/cloth_green.tres")
	M_OLIVE = load("res://materials/metal_olive.tres")
	M_BLACK = load("res://materials/black.tres")
	M_FLAME = load("res://materials/candle_flame.tres")
	level = Node3D.new()
	level.name = "Ch4NightChurch"
	level.set_script(LevelScript)

	_environment()
	nav = NavigationRegion3D.new()
	nav.name = "NavigationRegion3D"
	nav.navigation_mesh = _nav_mesh()
	_add(level, nav)

	_ground()
	_church()
	_basement()
	_furniture()
	_yard()
	_doors()
	_pickups()
	_zones()
	_lights()
	_points()
	_actors()

	var packed := PackedScene.new()
	var err := packed.pack(level)
	if err != OK:
		push_error("pack failed: %s" % error_string(err))
	err = ResourceSaver.save(packed, OUT)
	print("saved %s: %s" % [OUT, error_string(err)])
	level.free()
	quit()


# --- Помощники ---------------------------------------------------------------

func _add(parent: Node, node: Node) -> Node:
	parent.add_child(node)
	node.owner = level
	return node


func _group(parent: Node, group_name: String) -> Node3D:
	var n := Node3D.new()
	n.name = group_name
	return _add(parent, n)


## Блок по центру и размеру.
func _block(parent: Node, block_name: String, center: Vector3, size: Vector3, mat: Material,
		surface := &"wood", rot_deg := Vector3.ZERO, shadow := true) -> StaticBody3D:
	var b := StaticBody3D.new()
	b.set_script(BlockScript)
	b.name = block_name
	b.size = size
	b.material = mat
	b.surface = surface
	b.cast_shadow = shadow
	b.position = center
	b.rotation_degrees = rot_deg
	return _add(parent, b)


## Блок по двум углам (удобно для пола и стен).
func _box(parent: Node, block_name: String, from: Vector3, to: Vector3, mat: Material,
		surface := &"wood") -> StaticBody3D:
	var lo := Vector3(minf(from.x, to.x), minf(from.y, to.y), minf(from.z, to.z))
	var hi := Vector3(maxf(from.x, to.x), maxf(from.y, to.y), maxf(from.z, to.z))
	return _block(parent, block_name, (lo + hi) * 0.5, hi - lo, mat, surface)


## Стена вдоль оси с проёмами. along_x = true: стена тянется по X на линии z = line.
## openings: [[начало, конец, низ, верх], ...] в координатах вдоль стены.
func _wall(parent: Node, wall_name: String, along_x: bool, line: float, from: float, to: float,
		y0: float, y1: float, thickness: float, openings: Array, mat: Material) -> void:
	var cuts: Array[float] = [from, to]
	for o: Array in openings:
		cuts.append(o[0])
		cuts.append(o[1])
	cuts.sort()
	var idx := 0
	for i in cuts.size() - 1:
		var a := cuts[i]
		var b := cuts[i + 1]
		if b - a < 0.001:
			continue
		var mid := (a + b) * 0.5
		var spans: Array = [[y0, y1]]
		for o: Array in openings:
			if mid > o[0] and mid < o[1]:
				spans = []
				if o[2] > y0:
					spans.append([y0, o[2]])
				if o[3] < y1:
					spans.append([o[3], y1])
		for s: Array in spans:
			var center := Vector3.ZERO
			var size := Vector3.ZERO
			if along_x:
				center = Vector3(mid, (s[0] + s[1]) * 0.5, line)
				size = Vector3(b - a, s[1] - s[0], thickness)
			else:
				center = Vector3(line, (s[0] + s[1]) * 0.5, mid)
				size = Vector3(thickness, s[1] - s[0], b - a)
			_block(parent, "%s_%d" % [wall_name, idx], center, size, mat)
			idx += 1


func _instance(parent: Node, scene: PackedScene, node_name: String, pos: Vector3, yaw_deg := 0.0) -> Node3D:
	var n := scene.instantiate() as Node3D
	n.name = node_name
	n.position = pos
	n.rotation_degrees.y = yaw_deg
	return _add(parent, n)


func _mesh(parent: Node, mesh_name: String, mesh: Mesh, mat: Material, pos: Vector3,
		rot_deg := Vector3.ZERO, shadow := true) -> MeshInstance3D:
	var m := MeshInstance3D.new()
	m.name = mesh_name
	m.mesh = mesh
	m.material_override = mat
	m.position = pos
	m.rotation_degrees = rot_deg
	if not shadow:
		m.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	return _add(parent, m)


func _marker(parent: Node, marker_name: String, pos: Vector3, group: String = "") -> Marker3D:
	var m := Marker3D.new()
	m.name = marker_name
	m.position = pos
	if group != "":
		m.add_to_group(group, true)
	return _add(parent, m)


# --- Свет и навигация -----------------------------------------------------------

func _environment() -> void:
	var env := Environment.new()
	env.background_mode = Environment.BG_COLOR
	env.background_color = Color(0.016, 0.02, 0.032)
	env.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	env.ambient_light_color = Color(0.36, 0.42, 0.62)
	env.ambient_light_energy = 1.0
	env.fog_enabled = true
	env.fog_light_color = Color(0.016, 0.02, 0.032)
	env.fog_density = 0.06
	env.tonemap_mode = Environment.TONE_MAPPER_LINEAR
	var we := WorldEnvironment.new()
	we.name = "WorldEnvironment"
	we.environment = env
	_add(level, we)

	var moon := DirectionalLight3D.new()
	moon.name = "Moon"
	moon.light_color = Color(0.6, 0.68, 0.92)
	moon.light_energy = 0.15
	moon.shadow_enabled = true
	moon.directional_shadow_max_distance = 40.0
	moon.rotation_degrees = Vector3(-50.0, 35.0, 0.0)
	_add(level, moon)


func _nav_mesh() -> NavigationMesh:
	var nm := NavigationMesh.new()
	# Печём только по статичной геометрии слоя world: двери (слой door) не мешают —
	# Сторож распахивает их сам, когда подходит.
	nm.geometry_parsed_geometry_type = NavigationMesh.PARSED_GEOMETRY_STATIC_COLLIDERS
	nm.geometry_collision_mask = 1
	nm.cell_size = 0.1
	nm.cell_height = 0.1
	nm.agent_radius = 0.4
	nm.agent_height = 2.0
	nm.agent_max_climb = 0.2
	nm.agent_max_slope = 42.0
	return nm


# --- Земля -------------------------------------------------------------------

func _ground() -> void:
	var g := _group(nav, "Ground")
	var e := 26.0
	var x0 := -IN_X - WALL
	var x1 := IN_X + WALL
	var z0 := IN_Z_N - WALL
	var z1 := IN_Z_S + WALL
	# Земля кольцом вокруг церкви: под церковью — подпол, там земли быть не должно.
	_box(g, "North", Vector3(-e, -1, -e), Vector3(e, 0, z0), M_GROUND, &"ground")
	_box(g, "South", Vector3(-e, -1, z1), Vector3(e, 0, e), M_GROUND, &"ground")
	_box(g, "West", Vector3(-e, -1, z0), Vector3(x0, 0, z1), M_GROUND, &"ground")
	_box(g, "East", Vector3(x1, -1, z0), Vector3(e, 0, z1), M_GROUND, &"ground")
	# Невидимые границы мира (за ними туман и лес)
	var bounds := _group(g, "Bounds")
	for data: Array in [
			["N", Vector3(0, 2, -e), Vector3(2 * e, 6, 0.5)], ["S", Vector3(0, 2, e), Vector3(2 * e, 6, 0.5)],
			["W", Vector3(-e, 2, 0), Vector3(0.5, 6, 2 * e)], ["E", Vector3(e, 2, 0), Vector3(0.5, 6, 2 * e)]]:
		var b := _block(bounds, data[0], data[1], data[2], null)
		b.visible = false


# --- Церковь -----------------------------------------------------------------

func _church() -> void:
	var c := _group(nav, "Church")
	var ox := IN_X + WALL           # внешняя полуширина
	var zn := IN_Z_N - WALL
	var zs := IN_Z_S + WALL

	# Пол с дырой лаза в подпол
	var floor_node := _group(c, "Floor")
	_box(floor_node, "North", Vector3(-ox, -0.2, zn), Vector3(ox, 0, HOLE_Z0), M_PLANKS)
	_box(floor_node, "South", Vector3(-ox, -0.2, HOLE_Z1), Vector3(ox, 0, zs), M_PLANKS)
	_box(floor_node, "West", Vector3(-ox, -0.2, HOLE_Z0), Vector3(HOLE_X0, 0, HOLE_Z1), M_PLANKS)
	_box(floor_node, "East", Vector3(HOLE_X1, -0.2, HOLE_Z0), Vector3(ox, 0, HOLE_Z1), M_PLANKS)
	# Солея: алтарная часть чуть выше (8 см — переступается без прыжка)
	_box(floor_node, "Soleya", Vector3(-IN_X, 0, IN_Z_N), Vector3(IN_X, 0.08, ICON_Z - 0.15), M_PLANKS)

	var walls := _group(c, "Walls")
	var win := func(z: float) -> Array: return [z - 0.4, z + 0.4, 2.4, 3.6]
	# Южная стена: главный вход
	_wall(walls, "South", true, IN_Z_S + WALL * 0.5, -ox, ox, 0, WALL_H, WALL,
			[[-0.8, 0.8, 0.0, DOOR_H]], M_LOGS)
	# Северная стена: окно за алтарём
	_wall(walls, "North", true, IN_Z_N - WALL * 0.5, -ox, ox, 0, WALL_H, WALL,
			[[-0.5, 0.5, 2.6, 3.8]], M_LOGS)
	# Западная: три окна в нефе и одно в алтаре
	_wall(walls, "West", false, -IN_X - WALL * 0.5, IN_Z_N, IN_Z_S, 0, WALL_H, WALL,
			[win.call(-9.0), win.call(-3.0), win.call(1.0), win.call(5.0)], M_LOGS)
	# Восточная: окна + задняя дверь из алтаря
	_wall(walls, "East", false, IN_X + WALL * 0.5, IN_Z_N, IN_Z_S, 0, WALL_H, WALL,
			[[-9.4, -7.8, 0.0, DOOR_H], win.call(-3.0), win.call(1.0), win.call(5.0)], M_LOGS)
	# Иконостас: царские врата в центре и боковой проход справа — по церкви можно бегать кругом
	_wall(walls, "Iconostasis", true, ICON_Z, -IN_X, IN_X, 0, 4.2, 0.3,
			[[-0.8, 0.8, 0.0, DOOR_H], [2.4, 3.6, 0.0, 2.4]], M_DARK)

	# Потолок, крыша и барабан с куполом (силуэт виден из тумана)
	var roof := _group(c, "Roof")
	_box(roof, "Ceiling", Vector3(-ox, WALL_H, zn), Vector3(ox, WALL_H + 0.3, zs), M_DARK)
	_block(roof, "SlopeW", Vector3(-2.9, WALL_H + 1.6, -1.0), Vector3(6.6, 0.3, 21.6), M_DARK,
			&"wood", Vector3(0, 0, 30))
	_block(roof, "SlopeE", Vector3(2.9, WALL_H + 1.6, -1.0), Vector3(6.6, 0.3, 21.6), M_DARK,
			&"wood", Vector3(0, 0, -30))
	_block(roof, "Drum", Vector3(0, WALL_H + 3.6, 3.0), Vector3(2.6, 3.2, 2.6), M_LOGS)
	var decor := _group(c, "Decor")
	var dome := SphereMesh.new()
	dome.radius = 1.5
	dome.height = 2.6
	dome.radial_segments = 10
	dome.rings = 6
	_mesh(decor, "Dome", dome, M_DARK, Vector3(0, WALL_H + 5.8, 3.0))
	var cross_v := BoxMesh.new()
	cross_v.size = Vector3(0.12, 1.6, 0.12)
	var cross_h := BoxMesh.new()
	cross_h.size = Vector3(0.9, 0.12, 0.12)
	_mesh(decor, "CrossV", cross_v, M_DARK, Vector3(0, WALL_H + 7.6, 3.0))
	_mesh(decor, "CrossH", cross_h, M_DARK, Vector3(0, WALL_H + 7.8, 3.0))
	_mesh(decor, "CrossSlant", cross_h, M_DARK, Vector3(0, WALL_H + 7.2, 3.0), Vector3(0, 0, -20))

	# Иконы на иконостасе (лики потемнели)
	var icon := QuadMesh.new()
	icon.size = Vector2(0.8, 1.0)
	var i := 0
	for x: float in [-4.2, -3.2, -2.2, -1.3, 1.3, 4.3]:
		for y: float in [1.7, 3.2]:
			_mesh(decor, "Icon_%d" % i, icon, M_ICON, Vector3(x, y, ICON_Z + 0.16), Vector3.ZERO, false)
			i += 1


func _basement() -> void:
	var b := _group(nav, "Basement")
	var t := 0.3
	var top := -0.2
	_box(b, "Floor", Vector3(BASE_X0 - t, BASE_Y - 0.2, BASE_Z0 - t), Vector3(BASE_X1 + t, BASE_Y, BASE_Z1 + t), M_PLANKS)
	_box(b, "WallW", Vector3(BASE_X0 - t, BASE_Y, BASE_Z0 - t), Vector3(BASE_X0, top, BASE_Z1 + t), M_LOGS)
	_box(b, "WallE", Vector3(BASE_X1, BASE_Y, BASE_Z0 - t), Vector3(BASE_X1 + t, top, BASE_Z1 + t), M_LOGS)
	_box(b, "WallN", Vector3(BASE_X0, BASE_Y, BASE_Z0 - t), Vector3(BASE_X1, top, BASE_Z0), M_LOGS)
	_box(b, "WallS", Vector3(BASE_X0, BASE_Y, BASE_Z1), Vector3(BASE_X1, top, BASE_Z1 + t), M_LOGS)

	# Крутая лестница-пандус из нефа вниз: от края лаза на полу (z=4.4) до пола подпола (z=0.6)
	var drop := -BASE_Y
	var run := HOLE_Z1 - HOLE_Z0
	var length := sqrt(drop * drop + run * run)
	var angle := atan2(drop, run)
	var normal := Vector3(0, cos(angle), -sin(angle))
	var center := Vector3((HOLE_X0 + HOLE_X1) * 0.5, BASE_Y * 0.5, (HOLE_Z0 + HOLE_Z1) * 0.5) - normal * 0.1
	_block(b, "Ramp", center, Vector3(HOLE_X1 - HOLE_X0, 0.2, length), M_DARK, &"wood",
			Vector3(-rad_to_deg(angle), 0, 0))
	# Ступеньки-накладки только для вида (без коллизии ходить по пандусу удобнее)
	var step := BoxMesh.new()
	step.size = Vector3(HOLE_X1 - HOLE_X0, 0.06, 0.25)
	for k in 9:
		var f := (k + 0.5) / 9.0
		var p := Vector3((HOLE_X0 + HOLE_X1) * 0.5, -drop * (1.0 - f) + 0.02, HOLE_Z0 + run * f)
		_mesh(b, "StepLook_%d" % k, step, M_PLANKS, p, Vector3.ZERO, false)

	# Полки и ящики. Пустое место на средней полке — там лежала кукла.
	var y := BASE_Y
	for k in 3:
		_box(b, "Shelf_%d" % k, Vector3(BASE_X0, y + 0.5 + k * 0.7, -2.8), Vector3(BASE_X0 + 0.45, y + 0.55 + k * 0.7, 0.2), M_DARK)
	_block(b, "ShelfPost_0", Vector3(BASE_X0 + 0.22, y + 1.1, -2.85), Vector3(0.08, 2.2, 0.08), M_DARK)
	_block(b, "ShelfPost_1", Vector3(BASE_X0 + 0.22, y + 1.1, 0.25), Vector3(0.08, 2.2, 0.08), M_DARK)
	_block(b, "Crate_0", Vector3(-1.2, y + 0.35, 5.3), Vector3(0.7, 0.7, 0.7), M_CRATE)
	_block(b, "Crate_1", Vector3(-1.25, y + 1.0, 5.3), Vector3(0.6, 0.6, 0.6), M_CRATE, &"wood", Vector3(0, 15, 0))
	_block(b, "Crate_2", Vector3(-4.1, y + 0.35, 5.4), Vector3(0.7, 0.7, 0.7), M_CRATE)
	_block(b, "Crate_3", Vector3(-1.1, y + 0.3, -2.4), Vector3(0.6, 0.6, 0.6), M_CRATE, &"wood", Vector3(0, -10, 0))


func _furniture() -> void:
	var f := _group(nav, "Furniture")
	# Лавки вдоль стен — под ними можно спрятаться
	_instance(f, BENCH, "BenchW1", Vector3(-IN_X + 0.28, 0, -2.5), -90)
	_instance(f, BENCH, "BenchW2", Vector3(-IN_X + 0.28, 0, 7.0), -90)
	_instance(f, BENCH, "BenchE1", Vector3(IN_X - 0.28, 0, -2.5), 90)
	_instance(f, BENCH, "BenchE2", Vector3(IN_X - 0.28, 0, 3.0), 90)
	# Шкафы: в алтаре (ризница) и в подполе
	_instance(f, WARDROBE, "WardrobeAltar", Vector3(-3.6, 0.08, IN_Z_N + 0.36), 180)
	_instance(f, WARDROBE, "WardrobeBasement", Vector3(BASE_X1 - 0.36, BASE_Y, -1.2), 90)

	# Алтарь: престол, аналой, подсвечники
	_block(f, "Altar", Vector3(0, 0.58, -9.0), Vector3(1.3, 1.0, 0.9), M_DARK)
	_block(f, "Lectern", Vector3(0.0, 0.55, -4.6), Vector3(0.5, 1.1, 0.45), M_DARK, &"wood", Vector3(0, 0, 0))
	_block(f, "CandleStandL", Vector3(-1.8, 0.6, -5.3), Vector3(0.12, 1.2, 0.12), M_DARK, &"wood", Vector3.ZERO, false)
	_block(f, "CandleStandR", Vector3(1.8, 0.6, -5.3), Vector3(0.12, 1.2, 0.12), M_DARK, &"wood", Vector3.ZERO, false)

	# Ночлег друзей: спальники, рюкзаки. Друзья пропали, вещи остались.
	var camp := _group(f, "Camp")
	# Спальники тонкие (8 см), чтобы через них можно было перешагнуть
	_block(camp, "BagKostya", Vector3(2.0, 0.04, 5.6), Vector3(0.8, 0.08, 1.9), M_BLUE, &"wood", Vector3(0, 8, 0), false)
	_block(camp, "BagGrisha", Vector3(3.1, 0.04, 6.1), Vector3(0.8, 0.08, 1.9), M_GREEN, &"wood", Vector3(0, -12, 0), false)
	_block(camp, "BagKatya", Vector3(3.6, 0.04, 4.9), Vector3(0.8, 0.08, 1.9), M_RED, &"wood", Vector3(0, 80, 0), false)
	_block(camp, "BagSanya", Vector3(1.0, 0.04, 6.4), Vector3(0.8, 0.08, 1.9), M_BLUE, &"wood", Vector3(0, -4, 0), false)
	_block(camp, "Backpack1", Vector3(2.7, 0.25, 7.5), Vector3(0.38, 0.5, 0.26), M_GREEN, &"wood", Vector3(0, 20, 0))
	_block(camp, "Backpack2", Vector3(4.2, 0.22, 6.9), Vector3(0.34, 0.44, 0.24), M_RED, &"wood", Vector3(0, -30, 10))
	_block(camp, "Stove", Vector3(2.4, 0.1, 4.6), Vector3(0.3, 0.2, 0.3), M_OLIVE, &"wood", Vector3.ZERO, false)


func _yard() -> void:
	var y := _group(nav, "Yard")
	# УАЗ-«буханка», на котором приехали. Не заводится.
	var uaz := _group(y, "UAZ")
	uaz.position = Vector3(9.5, 0, 14.0)
	uaz.rotation_degrees.y = 25
	_block(uaz, "Body", Vector3(0, 1.3, 0), Vector3(1.9, 1.9, 4.4), M_OLIVE)
	_block(uaz, "Windshield", Vector3(0, 1.75, -2.21), Vector3(1.6, 0.6, 0.04), M_BLACK, &"wood", Vector3.ZERO, false)
	for w: Vector3 in [Vector3(-0.85, 0.36, -1.4), Vector3(0.85, 0.36, -1.4), Vector3(-0.85, 0.36, 1.4), Vector3(0.85, 0.36, 1.4)]:
		_block(uaz, "Wheel_%d" % uaz.get_child_count(), w, Vector3(0.28, 0.72, 0.72), M_BLACK)

	# Погост за церковью — «убогий дом». Кривые кресты и холмики.
	var graves := _group(y, "Pogost")
	var rng := RandomNumberGenerator.new()
	rng.seed = 777
	for k in 9:
		var p := Vector3(rng.randf_range(-6.0, 6.0), 0, rng.randf_range(-22.0, -15.0))
		var tilt := Vector3(rng.randf_range(-12, 12), rng.randf_range(0, 360), rng.randf_range(-15, 15))
		var cross := _group(graves, "Cross_%d" % k)
		cross.position = p
		cross.rotation_degrees = tilt
		_block(cross, "Post", Vector3(0, 0.75, 0), Vector3(0.1, 1.5, 0.1), M_DARK, &"wood", Vector3.ZERO, false)
		_block(cross, "Bar", Vector3(0, 1.15, 0), Vector3(0.6, 0.09, 0.09), M_DARK, &"wood", Vector3.ZERO, false)
		_block(graves, "Mound_%d" % k, p + Vector3(0, 0.1, 0.9), Vector3(0.8, 0.2, 1.6), M_GROUND, &"ground",
				Vector3(0, tilt.y, 0), false)

	# Остатки забора вокруг церкви
	var fence := _group(y, "Fence")
	var n := 0
	var uaz_pos := uaz.position
	for x in range(-12, 13, 2):
		if Vector3(x, 0, 13.0).distance_to(uaz_pos) < 3.5:
			continue
		if absi(x) > 2 or rng.randf() < 0.5:
			_block(fence, "PostS_%d" % n, Vector3(x, 0.6, 13.0), Vector3(0.12, 1.2, 0.12), M_DARK, &"wood",
					Vector3(0, 0, rng.randf_range(-10, 10)), false)
			n += 1
	for z in range(-12, 13, 2):
		if rng.randf() < 0.7:
			_block(fence, "PostW_%d" % n, Vector3(-12.0, 0.6, z), Vector3(0.12, 1.2, 0.12), M_DARK, &"wood",
					Vector3(rng.randf_range(-10, 10), 0, 0), false)
			n += 1

	# Лес по кругу: стволы с коллизией, кроны — просто конусы
	var forest := _group(y, "Forest")
	var crown := CylinderMesh.new()
	crown.top_radius = 0.0
	crown.bottom_radius = 1.8
	crown.height = 6.0
	crown.radial_segments = 6
	crown.rings = 1
	var crown_mat := M_GREEN
	var k := 0
	while k < 46:
		var a := rng.randf() * TAU
		var r := rng.randf_range(15.0, 24.5)
		var p := Vector3(cos(a) * r, 0, sin(a) * r)
		# не сажаем деревья на УАЗ и посреди погоста
		if p.distance_to(uaz_pos) < 4.0 or (absf(p.x) < 8.0 and p.z < -13.0 and p.z > -24.0):
			continue
		k += 1
		var h := rng.randf_range(7.0, 11.0)
		var tree := _group(forest, "Tree_%d" % k)
		tree.position = p
		_block(tree, "Trunk", Vector3(0, h * 0.5, 0), Vector3(0.35, h, 0.35), M_BARK, &"wood")
		_mesh(tree, "Crown", crown, crown_mat, Vector3(0, h * 0.55 + 2.0, 0))


func _doors() -> void:
	var d := _group(level, "Doors")
	# Корень двери — в точке петли, створка уходит вдоль +X.
	_instance(d, DOOR, "MainDoor", Vector3(-0.8, 0, IN_Z_S + WALL * 0.5), 0)
	_instance(d, DOOR, "BackDoor", Vector3(IN_X + WALL * 0.5, 0.0, -7.8), 90)


func _pickups() -> void:
	var p := _group(level, "Pickups")
	var items := [
		[BATTERY, "BatteryAltar", Vector3(0.2, 1.08, -9.0), "church_battery_altar"],
		[BATTERY, "BatteryBasement", Vector3(-4.1, BASE_Y + 0.7, 5.4), "church_battery_basement"],
		[BATTERY, "BatteryUaz", Vector3(7.4, 0.0, 15.0), "yard_battery_uaz"],
		[FLASH, "FlashBackpack", Vector3(3.15, 0.0, 7.15), "church_flash_backpack"],
		[FLASH, "FlashPogost", Vector3(6.8, 0.0, -14.5), "yard_flash_pogost"],
	]
	for it: Array in items:
		var n := _instance(p, it[0], it[1], it[2])
		n.set("pickup_id", it[3])


func _zones() -> void:
	var z := _group(level, "Zones")
	# Скрипучие половицы: посреди нефа, у царских врат и у входа
	_instance(z, CREAKY, "CreakyNave", Vector3(0.0, 0, 1.2))
	_instance(z, CREAKY, "CreakyIcon", Vector3(0.0, 0, -4.9))
	_instance(z, CREAKY, "CreakyEntrance", Vector3(0.0, 0, 7.8))
	_instance(z, CREAKY, "CreakyAltar", Vector3(2.5, 0.08, -8.4), 90)
	# Высокая трава: присел — почти невидим
	var g1 := _instance(z, GRASS, "GrassPogost", Vector3(-3.5, 0, -18.5))
	g1.set("size", Vector3(5.0, 1.2, 4.0))
	var g2 := _instance(z, GRASS, "GrassWest", Vector3(-10.0, 0, 3.0))
	g2.set("size", Vector3(3.5, 1.2, 6.0))
	# Зона эха в церкви и подполе
	var reverb := Area3D.new()
	reverb.name = "ChurchReverb"
	reverb.collision_layer = 1 << 5
	reverb.collision_mask = 0
	reverb.monitoring = false
	reverb.reverb_bus_enabled = true
	reverb.reverb_bus_name = &"Church"
	reverb.reverb_bus_amount = 0.6
	_add(z, reverb)
	var shape := CollisionShape3D.new()
	shape.name = "CollisionShape3D"
	var box := BoxShape3D.new()
	box.size = Vector3(IN_X * 2.0, WALL_H - BASE_Y, IN_Z_S - IN_Z_N)
	shape.shape = box
	shape.position = Vector3(0, (WALL_H + BASE_Y) * 0.5, (IN_Z_S + IN_Z_N) * 0.5)
	_add(reverb, shape)


func _lights() -> void:
	var l := _group(level, "Lights")
	# Свеча, которую Катя оставила у спальников. Единственный тёплый свет.
	_instance(l, CANDLE, "CampCandle", Vector3(2.6, 0, 5.3))
	# Красная лампада у иконостаса
	var lamp := OmniLight3D.new()
	lamp.name = "Lampada"
	lamp.light_color = Color(0.9, 0.25, 0.15)
	lamp.light_energy = 0.6
	lamp.omni_range = 3.5
	lamp.position = Vector3(0.0, 2.9, ICON_Z + 0.5)
	_add(l, lamp)
	var flame := SphereMesh.new()
	flame.radius = 0.04
	flame.height = 0.08
	var lamp_mesh := _mesh(lamp, "Glow", flame, M_FLAME, Vector3.ZERO, Vector3.ZERO, false)
	lamp_mesh.material_override = M_FLAME


func _points() -> void:
	var pts := _group(level, "Points")
	_marker(pts, "BasementKnock", Vector3(-2.6, -1.2, -1.5))
	var patrol := _group(pts, "Patrol")
	var patrol_points := {
		"NaveCenter": Vector3(0, 0, 2.0), "NaveSouth": Vector3(-1.5, 0, 7.0), "NaveIcon": Vector3(3.0, 0, -4.0),
		"Altar": Vector3(1.5, 0.08, -9.5), "Basement": Vector3(-2.6, BASE_Y, -1.5), "BasementSouth": Vector3(-3.0, BASE_Y, 5.0),
		"Pogost": Vector3(0, 0, -17.0), "YardEast": Vector3(9.0, 0, -2.0), "YardWest": Vector3(-9.0, 0, -2.0),
		"Uaz": Vector3(6.5, 0, 12.5), "YardSouthWest": Vector3(-8.0, 0, 13.0),
	}
	for key: String in patrol_points:
		_marker(patrol, key, patrol_points[key], "storozh_patrol")
	# Откуда он «появляется»: под окнами (стучит ногтем по стеклу) и в подполе
	var spawns := _group(pts, "Spawns")
	for side: float in [-1.0, 1.0]:
		for z: float in [-3.0, 1.0, 5.0]:
			var m := _marker(spawns, "Window%s%d" % ["W" if side < 0 else "E", int(z)],
					Vector3(side * 6.6, 0, z), "storozh_spawn")
			m.set_meta(&"window", true)
	_marker(spawns, "BasementDeep", Vector3(-3.6, BASE_Y, -2.2), "storozh_spawn")


func _actors() -> void:
	var player := _instance(level, PLAYER, "Player", Vector3(1.6, 0.0, 4.6), 35)
	player.name = "Player"
	var s := _instance(level, STOROZH, "Storozh", Vector3(-3.4, BASE_Y, -2.2), 0)
	s.name = "Storozh"
