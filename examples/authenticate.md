# Authenticates to Kuzzle

Use the `auth` controller to authenticate with any kind of strategy.  

Just provide the strategy name and associated credentials and the SDK will keep the JWT for you.  

### Common mistakes

### Example

**Prepare your Kuzzle**

```bash
# Creates a user with "local" strategy credentials
$ kourou query security:createUser --body '{"content":{"profileIds":["default"]}, "credentials":{"local": {"username": "Aschen","password": "mylehuong"}}}'
```

**Run the snippet**

```js
const { Kuzzle, Http } = require('kuzzle-sdk');

const kuzzle = new Kuzzle(new Http('localhost'))

kuzzle.on('networkError', console.error);

const run = async () => {
  await kuzzle.connect()

  // Login with username "Aschen"
  await kuzzle.auth.login('local', {
    username: 'Aschen',
    password: 'mylehuong'
  });

  // SDK is now authenticated
};

run();
```