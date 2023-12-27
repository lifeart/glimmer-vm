// https://astexplorer.net/#/gist/c2f0f7e4bf505471c94027c580af8329/c67119639ba9e8fd61a141e8e2f4cbb6f3a31de9

const enabled = false;

(async function(){
    if (!enabled) {
      return;
    }

  const syntax = await import('@glimmer/syntax/dist/dev/index.cjs');
  const preprocess = syntax.preprocess;
  const seenNodes = new Set();

  function ToJSType(node) {
      seenNodes.add(node);
    if (node.type === 'TextNode') {
          if (node.chars.trim().length === 0) {
            return null;
          }
        return node.chars;
      } else if (node.type === 'ElementNode') {
        return ElementToNode(node);
      } else if (node.type === 'PathExpression') {
        return `$:${node.original}`;
      } else if (node.type === 'MustacheStatement') {
        return ToJSType(node.path);
      } else if (node.type === 'BlockStatement') {
        return ['@each', node.params[0].original, node.program.blockParams[0], ToJSType(node.program.body.find(e => e.type === 'ElementNode'))]
      }
  }


  function ElementToNode(element) {
    const node = {
         tag: element.tag,
          attributes: element.attributes.map((attr) => {
            return [attr.name, ToJSType(attr.value)]
          }),
          children: element.children.map((el) => ToJSType(el)).filter(el => el !== null)
      }
      return node;
  }


  preprocess(`<div class="entry">
  <h1>{{title}}</h1>
  <div class="body">
    {{body}}
  </div>
  </div>
  `, {
    plugins: {
      ast: [
        function() {
          const programm = [];
          return {
            name: 'ast-transform',

            visitor: {
              ElementNode(node) {
                if (seenNodes.has(node)) {
                  return;
                }
                seenNodes.add(node);
                programm.push(ElementToNode(node))
              }
            }
          };
        }
      ]
    }
  });

  console.log(JSON.stringify(programm, null, 2));




})();


function MyComponent() {
  var n = () => {
    const roots = [DOM('div', {
      attributes: [['class', 'entry'],['id', DOM.maybeReactiveAttr(id)]]
    }, DOM('h1', {
      attributes: []
    }, title ), DOM('div', {
      attributes: [['class', 'body']]
    }, body ) )];

    return {
      nodes: roots.reduce((acc, root) => {
        return [...acc, root.node];
      }, []),
      destructors: roots.reduce((acc, root) => {
        return [...acc, ...root.destructors];
      }, []),
      index: 0,
    }
  };

  // return hbs`
  //   <div>
  //     <h1>{{title}}</h1>
  //     <div class="body">
  //       {{body}}
  //     </div>
  //   </tpl>
  // `;
}


const input = [
  {
    "tag": "div",
    "attributes": [
      [
        "class",
        "entry"
      ]
    ],
    "children": [
      {
        "tag": "h1",
        "attributes": [],
        "children": [
          "$:title"
        ]
      },
      [
        "@each",
        "items",
        "item",
        {
          "tag": "MyFunction",
          "attributes": [
            [
              "@name",
              "$:item"
            ]
          ],
          "children": []
        }
      ],
      {
        "tag": "div",
        "attributes": [
          [
            "class",
            "body"
          ]
        ],
        "children": [
          "$:body"
        ]
      }
    ]
  }
];

function serializeAttribute(key, value) {
  if (value.startsWith('$:')) {
    return `['${key}', DOM.maybeReactiveAttr(${value.replace('$:', '')})]`;
  }
  return `['${key}', '${value}']`;
}
function serializeChildren(children) {
  if (children.length === 0) {
    return 'null';
  }
  return `${children.map((child) => {
    if (typeof child === 'string') {
      if (child.startsWith('$:')) {
        return `${child.replace('$:', '')}`;
      }
      return `'${child}'`;
    }
    return serializeNode(child);
  }).join(', ')}`;
}

function serializeNode(node) {
  if (Array.isArray(node)) {
    // control node (each)
    const [, arrayName, itemName, child] = node;
    return `DOM.each(${arrayName}, (item) => {
      return ${serializeNode(child)}
    })`;
  }
  if (node.tag.toLowerCase() !== node.tag) {
    // it's component function
    return `${node.tag}({
      ${node.attributes.map((attr) => {
        return `${attr[0].replace('@', '')}: ${attr[1].replace('$:', '')}`;
      }).join(', ')}
    })`;
  }
  return `DOM('${node.tag}', {
    attributes: [${node.attributes.map((attr) => {
      return serializeAttribute(attr[0], attr[1]);
    }).join(', ')}]
  }, ${serializeChildren(node.children)} )`;
}

const results = input.reduce((acc, node) => {
  acc.push(serializeNode(node));
  return acc;
}, []);

const result = `() => {
  const roots = [${results.join(', ')}];

  return {
    nodes: roots.reduce((acc, root) => {
      return [...acc, ...root.nodes];
    }, []),
    destructors: roots.reduce((acc, root) => {
      return [...acc, ...root.destructors];
    }, []),
    index: 0,
  }
}`;

console.log(result);
