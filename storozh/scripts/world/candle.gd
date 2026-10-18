# Свеча: тёплый огонёк, который неровно мерцает. Почти единственный тёплый свет в игре.
extends Node3D

@export var base_energy := 1.6
@export var flicker := 0.35

@onready var light: OmniLight3D = $Light
@onready var flame: Node3D = $Flame

var _noise := FastNoiseLite.new()
var _t := randf() * 100.0


func _ready() -> void:
	_noise.frequency = 2.0


func _process(delta: float) -> void:
	_t += delta
	var n := _noise.get_noise_1d(_t * 10.0)
	light.light_energy = base_energy * (1.0 + n * flicker)
	flame.scale = Vector3.ONE * (1.0 + n * 0.25)
