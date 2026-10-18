# Всё, что должно пережить смену сцены: настройки, сюжетные флаги,
# контрольная точка и итог последней ночи. Сохраняется в user://save.json.
extends Node

signal settings_changed

const SAVE_PATH := "user://save.json"

# --- Настройки ---
var mouse_sensitivity := 1.0   # множитель, 1.0 = обычная
var invert_y := false
var pixel_scale := 3           # во сколько раз крупнее экранного пикселя рисуется 3D (2..4)
var master_volume := 0.8

# --- Прогресс ---
## Сюжетные флаги: выбор игрока, найденные знаки и т.д. (понадобятся на этапе 2).
var flags: Dictionary = {}
## Контрольная точка текущей ночи: night_time, battery, flash_charges, picked.
## Пустой словарь — начинать с самого начала.
var checkpoint: Dictionary = {}

# --- Итог последней ночи (для экрана смерти/победы, не сохраняется) ---
var last_result: Dictionary = {}


func _ready() -> void:
	load_game()
	apply_settings()


func apply_settings() -> void:
	var master := AudioServer.get_bus_index("Master")
	AudioServer.set_bus_volume_db(master, linear_to_db(maxf(master_volume, 0.0001)))
	settings_changed.emit()


# --- Флаги ---

func set_flag(flag: StringName, value: Variant = true) -> void:
	flags[String(flag)] = value


func get_flag(flag: StringName, default: Variant = false) -> Variant:
	return flags.get(String(flag), default)


# --- Контрольные точки ---

func has_checkpoint() -> bool:
	return not checkpoint.is_empty()


func save_checkpoint(data: Dictionary) -> void:
	checkpoint = data.duplicate(true)
	save_game()


func clear_checkpoint() -> void:
	checkpoint = {}
	save_game()


func is_picked(pickup_id: String) -> bool:
	return pickup_id != "" and pickup_id in checkpoint.get("picked", [])


# --- Сохранение на диск ---

func save_game() -> void:
	var data := {
		"version": 1,
		"settings": {
			"mouse_sensitivity": mouse_sensitivity,
			"invert_y": invert_y,
			"pixel_scale": pixel_scale,
			"master_volume": master_volume,
		},
		"flags": flags,
		"checkpoint": checkpoint,
	}
	var file := FileAccess.open(SAVE_PATH, FileAccess.WRITE)
	if file == null:
		push_warning("Не удалось сохранить игру: %s" % error_string(FileAccess.get_open_error()))
		return
	file.store_string(JSON.stringify(data, "\t"))


func load_game() -> void:
	if not FileAccess.file_exists(SAVE_PATH):
		return
	var parsed: Variant = JSON.parse_string(FileAccess.get_file_as_string(SAVE_PATH))
	if typeof(parsed) != TYPE_DICTIONARY:
		push_warning("Файл сохранения повреждён, начинаем с нуля")
		return
	var settings: Dictionary = parsed.get("settings", {})
	mouse_sensitivity = float(settings.get("mouse_sensitivity", mouse_sensitivity))
	invert_y = bool(settings.get("invert_y", invert_y))
	pixel_scale = clampi(int(settings.get("pixel_scale", pixel_scale)), 2, 4)
	master_volume = clampf(float(settings.get("master_volume", master_volume)), 0.0, 1.0)
	flags = parsed.get("flags", {})
	checkpoint = parsed.get("checkpoint", {})
