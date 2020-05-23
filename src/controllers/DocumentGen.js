const BaseController = require('./Base');
const DocumentSearchResult = require('../core/searchResult/Document');

const swagger = {
  "/{index}/{collection}/_create": {
    "post": {
      "tags": [
        "Document Controller"
      ],
      "description": "Creates a document",
      "operationId": "document:create",
      "parameters": [
        {
          "name": "index",
          "in": "path",
          "schema": {
            "type": "string"
          },
          "required": true
        },
        {
          "name": "collection",
          "in": "path",
          "schema": {
            "type": "string"
          },
          "required": true
        },
        {
          "name": "_id",
          "in": "query",
          "schema": {
            "type": "string"
          },
          "required": false
        },
        {
          "name": "refresh",
          "in": "query",
          "schema": {
            "type": "string"
          },
          "required": false
        }
      ],
      "requestBody": {
        "content": {
          "application/json": {
            "schema": {
              "type": "object"
            }
          }
        },
        "required": true
      },
      "responses": {
        "200": {
          "description": "Document created",
          "content": {
            "application/json": {
              "schema": {
                "type": "object",
                "properties": {
                  "result": {

                  }
                }
              }
            }
          }
        },
        "400": {
          "description": "Missing parameters"
        }
      }
    }
  }
}

const methods = {
  'create': {
    url: "/{index}/{collection}/_create",
    method: 'post',
    description: 'Creates a document',
    parameters: [
      {
        "name": "index",
        "in": "path",
        "schema": { "type": "string" },
        "position": 0,
        "required": true
      },
      {
        "name": "collection",
        "in": "path",
        "schema": { "type": "string" },
        "position": 1,
        "required": true
      },
      {
        "name": "_id",
        "in": "query",
        "schema": { "type": "string" },
        "position": 3,
        "required": false
      },
      {
        "name": "refresh",
        "in": "query",
        "schema": { "type": "string" },
        "position": 'options',
        "required": false
      }
    ],
    requestBody: {
      "position": 2,
      "content": {
        "type": "object"
      },
      "required": true
    },
    success: {
      "description": "Document created",
      "valuableResult": "result",
      "content": {
        "type": "object",
        "properties": {
          "volatiles": {
            "type": "object"
          },
          "result": {
            "type": "object",
            "description": "Created document",
            "valuable": true,
            "properties": {
              "_id": {
                "type": "string",
                "description": "Document ID",
                "example": "HjzlsKjai8J2SQ"
              },
              "_source": {
                "type": "object",
                "description": "Document content"
              }
            }
          }
        }
      }
    }
  }
}

class DocumentController extends BaseController {

  /**
   * @param {Kuzzle} kuzzle
   */
  constructor (kuzzle) {
    super(kuzzle, 'document');

    for (const [method, definition] of Object.entries(methods)) {
      const methodArguments = [];

      for (const parameter of definition.parameters) {
        if (parameter.position !== 'options') {
          methodArguments.push(parameter);
        }
      }

      if (definition.requestBody && definition.requestBody.position !== 'options') {
        methodArguments.push({name: 'body', ...definition.requestBody});
      }

      methodArguments.sort((a, b) => a.position - b.position)

      const valuableResult = definition.success.valuableResult;

      this[method] = (...args) => {
        const request = {};

        for (const methodArgument of methodArguments) {
          request[methodArgument.name] = args[methodArgument.position];
        }

        const options = methodArguments.some(e => e.position = 'options')
          ? args[args.length - 1]
          : {}

        return this.query(request, options)
          .then(response => get(response, valuableResult));
      }
    }
  }

}


function get (object, path) {
  const index = path.indexOf('.');

  if (index === -1) {
    return object[path];
  }

  return get(object[path.substr(0, index)], path.substr(index + 1));
}

module.exports = DocumentController;

const kuzzle = {
  query: async (req, opts) => {
    console.log({ req, opts })
    return {
      volatiles: { hey: 'gringo' },
      result: { _id: 'uniq-id', _source: { name: 'adrien' } }
    }
  }
}

const doc = new DocumentController(kuzzle);

(async () => {
  const res = await doc.create('idx', 'col', { name: 'Adri'}, 'uniq-id', { refresh: 'wait_for'})

  console.log({res})
})();
