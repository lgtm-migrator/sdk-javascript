<template>
  <div id="app">
    <div class="wrapper">
      <input autofocus type="text" v-model="message" v-on:keyup.enter="sendMessage">
      <button @click="sendMessage">Send</button>
    </div>
    <div
      v-for="message in messages"
      :key="message._id"
      :class="`messages ${message.username === username? 'fromMe': 'fromOthers'}`"
    >
      <span class="username">{{ message.username }}</span>
      <span>({{ getDate(message.createdAt) }})</span>
      <p>{{ message.value }}</p>
    </div>
  </div>
</template>

<script>
import kuzzle from "./services/kuzzle";

export default {
  name: "app",
  data() {
    return {
      message: "",
    };
  },
  computed: {
    username() {
      return this.$store.state.username;
    },
    messages() {
      return this.$store.state.messages;
    }
  },
  methods: {
    getDate(timestamp) {
      const date = new Date(timestamp);
      return date.toString().split("GMT")[0];
    },
    async sendMessage() {
      if (this.message === "") return;
      await this.$store.dispatch('SEND_MESSAGE', {kuzzle, message: this.message})
      this.message = "";
    },
  },
  async mounted() {
    const username = prompt("Please enter your name", "Harry Potter");
    this.$store.commit('SET_USERNAME', username);
    await this.$store.dispatch('INIT', { kuzzle });
  }
};
</script>

<style>
#app {
  font-family: "Avenir", Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-align: center;
  color: #2c3e50;
  margin-top: 60px;
}

.username {
  font-weight: bold;
}

.wrapper {
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 10px;
}

.messages {
  padding: 10px;
  margin: 1px;
  width: 45vw;
  border-radius: 10px;
}

.fromMe {
  text-align: right;
  float: right;
  margin-left: 49vw;
  background-color: #9ca4f0;
}

.fromOthers {
  text-align: left;
  margin-right: 49vw;
  float: left;
  background-color: rgb(206, 246, 147);
}
</style>
