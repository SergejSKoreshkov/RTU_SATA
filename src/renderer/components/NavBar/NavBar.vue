<template>
    <div class="navbar">
        <div class="row">
            <ul class="pagination mb-0">
                <li
                    :class="`page-item ${activePath === route.path ? 'active' : ''}`"
                    v-for="route in routes"
                    :key="route.name"
                    @click="goTo(route.path)"
                >
                    <a class="page-link" href="#">{{ route.name }}</a>
                </li>
            </ul>
        </div>
    </div>
</template>

<script>
export default {
  name: 'NavBar',
  methods: {
    goTo (path) {
      if (this.$router.currentRoute.path !== path) {
        this.$router.push(path)
      }
    }
  },
  data () {
    return {
      routes: [
        { path: '/', name: 'Lab 1' },
        { path: '/lab1video', name: 'Lab 1 with web video' },
        { path: '/lab2', name: 'Lab 2' }
      ],
      activePath: this.$router.currentRoute.path
    }
  },
  watch: {
    $route (to) {
      this.activePath = to.path
    }
  }
}
</script>

<style scoped>
    .navbar .row {
        width: 100%;
    }
</style>