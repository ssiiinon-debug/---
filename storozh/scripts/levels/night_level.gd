# Уровень ночи: геометрия, свет, точки для Сторожа. Здесь же небо и туман к рассвету.
# Навигационная сетка печётся при запуске из всей геометрии внутри NavigationRegion3D,
# поэтому, если двигаешь стены в редакторе, перепекать вручную ничего не надо.
class_name NightLevel
extends Node3D

@export var night_color := Color(0.016, 0.02, 0.032)
@export var dawn_color := Color(0.46, 0.49, 0.55)
@export var night_ambient := 1.0
@export var dawn_ambient := 2.2
@export var night_fog := 0.06
@export var dawn_fog := 0.03
@export var night_moon := 0.15
@export var dawn_moon := 0.7

@onready var world_env: WorldEnvironment = $WorldEnvironment
@onready var moon: DirectionalLight3D = $Moon
@onready var nav_region: NavigationRegion3D = $NavigationRegion3D
@onready var player: Player = $Player
@onready var storozh: Storozh = $Storozh
@onready var knock_point: Marker3D = $Points/BasementKnock

var _birds: AudioStreamPlayer3D


func _ready() -> void:
	# Окружение у каждого запуска своё: рассвет меняет его на лету.
	world_env.environment = world_env.environment.duplicate()
	nav_region.bake_navigation_mesh(false)
	set_dawn(0.0)


## t = 0 полночь, t = 1 рассвет. Небо светлеет только в последней трети ночи.
func set_dawn(t: float) -> void:
	var k := smoothstep(0.7, 1.0, t)
	var env := world_env.environment
	var sky := night_color.lerp(dawn_color, k)
	env.background_color = sky
	env.fog_light_color = sky
	env.fog_density = lerpf(night_fog, dawn_fog, k)
	env.ambient_light_energy = lerpf(night_ambient, dawn_ambient, k)
	moon.light_energy = lerpf(night_moon, dawn_moon, k)


func knock() -> void:
	AudioBus.play_3d(AudioBus.get_stream("knock_basement"), knock_point.global_position, 6.0, 40.0)


func laugh_from_basement() -> void:
	AudioBus.play_3d(AudioBus.get_stream("storozh_laugh"), knock_point.global_position, 4.0, 40.0)


## Птицы запевают только на рассвете (в деревне до этого мёртвая тишина).
func start_birds() -> void:
	_birds = AudioStreamPlayer3D.new()
	_birds.stream = AudioBus.get_stream("birds")
	AudioBus._make_looping(_birds.stream)
	_birds.bus = &"Ambience"
	_birds.unit_size = 30.0
	_birds.volume_db = -30.0
	add_child(_birds)
	_birds.global_position = player.global_position + Vector3(8.0, 6.0, -10.0)
	_birds.play()
	create_tween().tween_property(_birds, "volume_db", -6.0, 12.0)


## После загрузки контрольной точки Сторож не должен стоять у игрока за спиной.
func place_storozh_away_from_player() -> void:
	var best: Node3D = null
	var best_dist := 0.0
	for p: Node3D in get_tree().get_nodes_in_group(&"storozh_patrol"):
		var d := p.global_position.distance_to(player.global_position)
		if d > best_dist:
			best_dist = d
			best = p
	if best:
		storozh.global_position = best.global_position
