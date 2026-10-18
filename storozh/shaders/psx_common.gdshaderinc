// Общий кусок PS1-шейдеров: «дрожание» вершин.
// Вершины прилипают к грубой экранной сетке, как на PS1 без субпиксельной точности.
// Чем меньше jitter_grid, тем сильнее дрожь при движении камеры.
uniform vec2 jitter_grid = vec2(320.0, 180.0);

vec4 psx_snap(vec4 clip) {
	if (clip.w > 0.0) {
		clip.xy = round(clip.xy / clip.w * jitter_grid) / jitter_grid * clip.w;
	}
	return clip;
}
