export const MAX_DIAGRAM_SIZE = 4 * 1024 * 1024;
const itemClasses = new Set(["Layer", "Path", "Group", "PointText"]);
const itemTypes = {
  Path: ["shape", "drawing", "selectionUI"],
  Group: ["connector"],
  PointText: ["text"],
};
const attributeNames = new Set([
  "applyMatrix", "matrix", "selected", "visible", "locked", "opacity", "name", "data",
  "segments", "closed", "strokeColor", "strokeWidth", "strokeCap", "strokeJoin",
  "dashArray", "dashOffset", "fillColor", "content", "fontFamily", "fontSize",
  "fontWeight", "leading", "justification",
]);
const point = (value) => Array.isArray(value) && value.length === 2 && value.every(Number.isFinite);
const segment = (value) => point(value) ||
  (Array.isArray(value) && value.length === 3 && value.every(point));

export function parseDiagram(json) {
  if (typeof json !== "string" || json.length > MAX_DIAGRAM_SIZE) {
    throw new Error("Invalid diagram size");
  }
  const layers = JSON.parse(json);
  const shapes = new Set();
  const references = [];
  let nodes = 0;
  const fail = () => { throw new Error("Invalid diagram structure"); };
  const record = (value) => value && Object.getPrototypeOf(value) === Object.prototype;
  const validateValue = (value, depth) => {
    if (++nodes > 500000 || depth > 12) fail();
    if (typeof value === "number" && (!Number.isFinite(value) || Math.abs(value) > 1e9)) fail();
    if (Array.isArray(value)) {
      if (typeof value[0] === "string") fail();
      value.forEach((entry) => validateValue(entry, depth + 1));
    } else if (record(value)) {
      for (const [key, entry] of Object.entries(value)) {
        if (["__proto__", "prototype", "constructor"].includes(key)) fail();
        validateValue(entry, depth + 1);
      }
    }
  };

  const validateItem = (item, depth) => {
    if (!Array.isArray(item) || item.length !== 2) fail();
    const [kind, props] = item;
    if (!itemClasses.has(kind) || !record(props)) fail();
    const { children, ...attributes } = props;
    if (Object.keys(attributes).some((key) => !attributeNames.has(key))) fail();
    validateValue(attributes, 0);
    if (props.matrix !== undefined &&
        !(Array.isArray(props.matrix) && props.matrix.length === 6 && props.matrix.every(Number.isFinite))) fail();
    if (kind === "Path" && !(Array.isArray(props.segments) && props.segments.every(segment))) fail();
    if (kind === "PointText" && typeof props.content !== "string") fail();
    if (props.data !== undefined && !record(props.data)) fail();
    const data = props.data;
    if (depth === 0) {
      if (kind !== "Layer") fail();
    } else if (depth === 1) {
      if (!itemTypes[kind]?.includes(data?.type)) fail();
      if (data.type === "shape") {
        if (typeof data.shapeId !== "string" || !data.shapeId || shapes.has(data.shapeId)) fail();
        shapes.add(data.shapeId);
      }
      if (data.type === "text" && data.attachedToShapeId) references.push(data.attachedToShapeId);
      if (data.type === "connector") {
        if (data.fromShapeId === data.toShapeId) fail();
        references.push(data.fromShapeId, data.toShapeId);
      }
    } else if (depth !== 2 || kind !== "Path" || data) fail();
    if (kind === "Layer" || kind === "Group") {
      if (kind === "Layer" && children === undefined) return;
      if (!Array.isArray(children)) fail();
      if (kind === "Group" && (children.length !== (data.bidirectional ? 3 : 2) ||
          children.some((child, index) => child?.[1]?.segments?.length !== (index ? 3 : 2)))) fail();
      children.forEach((child) => validateItem(child, depth + 1));
      props.children = children.filter((child) => child[1].data?.type !== "selectionUI");
    } else if (children !== undefined) fail();
    delete props.selected;
  };

  if (!Array.isArray(layers)) fail();
  layers.forEach((layer) => validateItem(layer, 0));
  if (references.some((id) => !shapes.has(id))) fail();
  return layers;
}
