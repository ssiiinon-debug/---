# Проверка: загружает все скрипты и сцены проекта, чтобы поймать ошибки до запуска.
#   godot --headless --path . --script res://tools/check_scripts.gd
extends SceneTree


# _initialize, а не _init: к этому моменту автозагрузки (GameState, AudioBus…) уже созданы.
func _initialize() -> void:
	var failed := 0
	var files := _collect("res://", [])
	for path: String in files:
		var res := load(path)
		if res == null:
			print("FAIL ", path)
			failed += 1
		elif res is PackedScene:
			var inst: Node = (res as PackedScene).instantiate()
			if inst == null:
				print("FAIL instantiate ", path)
				failed += 1
			else:
				inst.free()
	print("checked %d files, failed %d" % [files.size(), failed])
	quit(1 if failed > 0 else 0)


func _collect(dir: String, out: Array) -> Array:
	for sub in DirAccess.get_directories_at(dir):
		if sub.begins_with(".") or sub == "tools" or sub == "tests":
			continue
		_collect(dir.path_join(sub), out)
	for f in DirAccess.get_files_at(dir):
		if f.ends_with(".gd") or f.ends_with(".tscn") or f.ends_with(".tres"):
			out.append(dir.path_join(f))
	return out
