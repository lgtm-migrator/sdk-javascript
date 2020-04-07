# Creates new documents

Use the `document` controller to creates new documents.  

Just provide an index, a collection and the document body.  

### Example

```bash
# Creates an index
$ kourou query index:create -a index=nyc-open-data

# Creates a collection
$ kourou query collection:create -a index=nyc-open-data -a collection=yellow-taxi
```

```js
const { Kuzzle, Http } = require('kuzzle-sdk');

const kuzzle = new Kuzzle(new Http('localhost'))

kuzzle.on('networkError', console.error);

const run = async () => {
  await kuzzle.connect()

  await kuzzle.document.create('nyc-open-data', 'yellow-taxi', {
    name: 'Aschen',
    licence: 'B',
    plate: '42 XDF 94'
  });
};

run();
```