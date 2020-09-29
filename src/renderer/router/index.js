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
      path: '/lab2',
      name: 'lab2',
      component: require('@/components/Lab2').default
    },
    {
      path: '*',
      redirect: '/'
    }
  ]
})
