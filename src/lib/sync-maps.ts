import type { Map as MlMap } from "maplibre-gl";

export function syncMaps(map1: MlMap | null, map2: MlMap | null): () => void {
  if (!map1 || !map2) return () => {};

  let active: MlMap | null = null;

  const onMove1 = () => {
    if (active && active !== map1) return;
    active = map1;
    map2.jumpTo({
      center: map1.getCenter(),
      zoom: map1.getZoom(),
      bearing: map1.getBearing(),
      pitch: map1.getPitch(),
    });
  };

  const onMoveEnd1 = () => {
    if (active === map1) active = null;
  };

  const onMove2 = () => {
    if (active && active !== map2) return;
    active = map2;
    map1.jumpTo({
      center: map2.getCenter(),
      zoom: map2.getZoom(),
      bearing: map2.getBearing(),
      pitch: map2.getPitch(),
    });
  };

  const onMoveEnd2 = () => {
    if (active === map2) active = null;
  };

  map1.on("move", onMove1);
  map1.on("moveend", onMoveEnd1);
  map2.on("move", onMove2);
  map2.on("moveend", onMoveEnd2);

  return () => {
    map1.off("move", onMove1);
    map1.off("moveend", onMoveEnd1);
    map2.off("move", onMove2);
    map2.off("moveend", onMoveEnd2);
  };
}
