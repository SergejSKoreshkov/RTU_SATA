<template>
  <div id="app">
    <NavBar></NavBar>
    <hr class="mt-0">
    <router-view></router-view>
  </div>
</template>

<script>
  import NavBar from '@/components/NavBar/NavBar.vue'

  export default {
    name: 'test',
    components: {
      NavBar
    }
  }
</script>

<style>
  #app {
    margin: 1em;
  }
</style>
