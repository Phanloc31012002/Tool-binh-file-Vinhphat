// Small geometric Illustrator double. Production JSX is executed unchanged;
// this supplies only the collections/transforms used by the renderer.
function illustrator(options = {}) {
  const doc = {
    selection: [],
    scaleFactor: options.scaleFactor || 1,
    activate() {},
  };
  const originals = [],
    duplicates = [];
  let duplicateCount = 0;
  function item(bounds, identity, layer, source = false) {
    const object = {
      identity,
      layer,
      parent: layer,
      angle: 0,
      reflected: false,
      typename: "RasterItem",
      _bounds: bounds.slice(),
      _points: [
        [bounds[0], bounds[1]],
        [bounds[2], bounds[1]],
        [bounds[2], bounds[3]],
        [bounds[0], bounds[3]],
      ],
      get geometricBounds() {
        return this._bounds.slice();
      },
      get visibleBounds() {
        return this._bounds.slice();
      },
      _updateBounds() {
        this._bounds = [
          Math.min(...this._points.map((p) => p[0])),
          Math.max(...this._points.map((p) => p[1])),
          Math.max(...this._points.map((p) => p[0])),
          Math.min(...this._points.map((p) => p[1])),
        ];
      },
      translate(x, y) {
        this._points = this._points.map((p) => [p[0] + x, p[1] + y]);
        this._updateBounds();
      },
      rotate(angle) {
        this.angle += angle;
        const [l, t, r, b] = this._bounds,
          cx = (l + r) / 2,
          cy = (t + b) / 2;
        const a = (angle * Math.PI) / 180;
        this._points = this._points.map(([x, y]) => [
          cx + (x - cx) * Math.cos(a) - (y - cy) * Math.sin(a),
          cy + (x - cx) * Math.sin(a) + (y - cy) * Math.cos(a),
        ]);
        this._updateBounds();
      },
      transform(
        matrix,
        changePositions,
        fillPatterns,
        fillGradients,
        strokePatterns,
        lineWidths,
        anchor,
      ) {
        if (options.failReflection)
          throw new Error("Injected reflection failure");
        if (anchor !== "center")
          throw new Error("Unsupported mock transformation anchor");
        const [l, t, r, b] = this._bounds,
          cx = (l + r) / 2,
          cy = (t + b) / 2;
        this._points = this._points.map(([x, y]) => [
          cx + (x - cx) * matrix.scaleX,
          cy + (y - cy) * matrix.scaleY,
        ]);
        this.reflected = matrix.scaleX * matrix.scaleY < 0;
        this._updateBounds();
      },
      duplicate(target) {
        if (++duplicateCount === options.failDuplicateAt)
          throw new Error("Injected duplicate failure");
        const copy = item(this._bounds, this.identity, target);
        copy._points = this._points.map((p) => p.slice());
        copy.angle = this.angle;
        copy.reflected = this.reflected;
        target.pageItems.push(copy);
        duplicates.push(copy);
        return copy;
      },
      setEntirePath(points) {
        this._points = points.map((p) => p.slice());
        this._updateBounds();
      },
    };
    if (source) {
      layer.pageItems.push(object);
      originals.push(object);
    }
    return object;
  }
  doc.layers = [];
  doc.layers.add = function () {
    const layer = {
      name: "",
      pageItems: [],
      locked: false,
      visible: true,
      zOrder() {},
      remove() {
        doc.layers.splice(doc.layers.indexOf(this), 1);
      },
    };
    layer.pathItems = {
      add() {
        const p = item([0, 0, 0, 0], "path", layer);
        layer.pageItems.push(p);
        return p;
      },
      ellipse(top, left, width, height) {
        const p = item([left, top, left + width, top - height], "dot", layer);
        p.typename = "PathItem";
        layer.pageItems.push(p);
        return p;
      },
    };
    doc.layers.push(layer);
    return layer;
  };
  doc.artboards = [];
  doc.artboards.add = function (rect) {
    const board = {
      artboardRect: rect.slice(),
      name: "",
      remove() {
        doc.artboards.splice(doc.artboards.indexOf(this), 1);
      },
    };
    doc.artboards.push(board);
    return board;
  };
  doc.artboards.setActiveArtboardIndex = (index) => {
    doc.activeArtboardIndex = index;
  };
  doc.artboards.getActiveArtboardIndex = () => doc.activeArtboardIndex || 0;
  doc.artboards.add(options.rect || [0, 100, 100, 0]);
  const sourceLayer = doc.layers.add();
  sourceLayer.name = "Layer 1";
  doc.activeLayer = sourceLayer;
  const context = {
    app: {
      documents: [doc],
      activeDocument: doc,
      coordinateSystem: "user-coordinates",
      getScaleMatrix(x, y) {
        return { scaleX: x / 100, scaleY: y / 100 };
      },
    },
    CoordinateSystem: { DOCUMENTCOORDINATESYSTEM: "document-coordinates" },
    CMYKColor: function () {},
    ElementPlacement: { PLACEATEND: 1 },
    ZOrderMethod: { SENDTOBACK: 0, BRINGTOFRONT: 1 },
    Transformation: { CENTER: "center" },
    // Accept the existing KTS uneven-count prompt in geometry-only tests.
    Window: function () {
      const buttons = [];
      function control(kind) {
        const c = {
          preferredSize: {},
          add(type, _, title) {
            const next = control(type);
            if (type === "button") buttons.push({ title, next });
            return next;
          },
        };
        return c;
      }
      const d = control("dialog");
      d.close = () => {};
      d.show = () => buttons.find((b) => b.title === "Tiếp tục").next.onClick();
      return d;
    },
  };
  return {
    doc,
    context,
    sourceLayer,
    originals,
    duplicates,
    source(bounds, identity) {
      return item(bounds, identity, sourceLayer, true);
    },
  };
}
module.exports = illustrator;
