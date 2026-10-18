# Скрипучие половицы. Пока игрок стоит в зоне, каждый его шаг (кроме приседа) скрипит.
# Визуально такие доски чуть светлее остальных — внимательный игрок их обходит.
class_name CreakyBoard
extends Area3D


func _ready() -> void:
	collision_layer = 0
	collision_mask = 1 << 1  # слой player
	body_entered.connect(func(body: Node3D) -> void:
		if body is Player:
			body.creaky_boards += 1)
	body_exited.connect(func(body: Node3D) -> void:
		if body is Player:
			body.creaky_boards = maxi(body.creaky_boards - 1, 0))
