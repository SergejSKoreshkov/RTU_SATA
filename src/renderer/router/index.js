import Vue from 'vue'
import Router from 'vue-router'

Vue.use(Router)

export default new Router({
  routes: [
    {
      path: '/',
      name: 'lab1',
      component: require('@/components/Lab1').default
    },
    {
      path: '/lab1video',
      name: 'lab1video',
      component: require('@/components/Lab1-video').default
    },
    {
      path: '*',
      redirect: '/'
    }
  ]
})
