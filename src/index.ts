export default {
  async fetch(request, env, ctx) {
   
    return new Response('Halo dari Shoesclean Worker!', {
      headers: { 'content-type': 'text/plain' },
    });
  },


};
