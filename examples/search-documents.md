# Searches for documents

Use the `document` controller `search` method to search for documents.  

This method directly takes Elasticsearch queries so just ask what you need and Kuzzle will give it to you.

### Example

```bash
# Creates an index
$ kourou query index:create -a index=nyc-open-data

# Creates a collection with a mapping
$ kourou query collection:create -a index=nyc-open-data -a collection=yellow-taxi --body '{"properties": {"age": {"type": "integer"}}}'

# Creates 10 documents
$ for i in `seq 10`; do kourou document:create nyc-open-data yellow-taxi --body "{ \"age\": $i }"; done
```

```js
const { Kuzzle, Http } = require('kuzzle-sdk');

const kuzzle = new Kuzzle(new Http('localhost'))

kuzzle.on('networkError', console.error);

const run = async () => {
  await kuzzle.connect()

  const result = await kuzzle.document.search('nyc-open-data', 'yellow-taxi', {
    query: {
      range: {
        age: { lte: 8, gte: 5 }
      }
    }
  });

  // Documents with age between 5 and 8
  console.log(result.hits);
};

run();
```