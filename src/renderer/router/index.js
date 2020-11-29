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
      path: '/lab3',
      name: 'lab3',
      component: require('@/components/Lab3').default
    },
    {
      path: '/lab4',
      name: 'lab4',
      component: require('@/components/Lab4').default
    },
    {
      path: '*',
      redirect: '/'
    }
  ]
})
