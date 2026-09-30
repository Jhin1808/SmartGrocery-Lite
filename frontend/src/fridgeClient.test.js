import { createFridgeClient } from "./fridgeClient";
const food={id:"x",name:"Chicken",quantity:1,unit:"items",expiry:null};
function setup() {
  const api={request:jest.fn().mockRejectedValue(Object.assign(new Error("Not Found"),{status:404})), me:jest.fn().mockResolvedValue({id:1}), search:jest.fn().mockResolvedValue([{external_id:"42"}]), detail:jest.fn().mockResolvedValue({external_id:"42",title:"Dinner",ingredients:[{name:"Chicken",original:"Chicken"},{name:"Salt",original:"Salt"}]}),items:jest.fn().mockResolvedValue([]),addItem:jest.fn().mockResolvedValue({}),base:"test"};
  return {api,client:createFridgeClient(api)};
}
beforeEach(() => localStorage.clear());
test("missing fridge route supports ingredient saves, reloads and removal",async()=>{
 const {client,api}=setup(); expect(await client.read()).toEqual([]);
 const saved=await client.save(food);
 expect(client.browserOnly()).toBe(true);
 expect((await createFridgeClient(api).read())[0].name).toBe("Chicken");
 await client.remove(saved.id); expect(await client.read()).toEqual([]);
});
test("browser inventory is scoped to account and never masks authentication failures",async()=>{
 const {client,api}=setup();await client.read();await client.save(food);
 api.me.mockResolvedValue({id:2});expect(await client.read()).toEqual([]);
 api.request.mockRejectedValue(Object.assign(new Error("Could not validate credentials"),{status:401}));
 await expect(client.read()).rejects.toThrow("Could not validate credentials");
});
test("legacy recipe API matches checked food and adds only missing, nonduplicate ingredients",async()=>{
 const {client,api}=setup();await client.read();await client.save(food);
 const results=await client.meals();expect(results[0].have[0].name).toBe("Chicken");expect(results[0].missing[0].name).toBe("Salt");
 expect(await client.missingToList("42",7)).toEqual({added:1});
 expect(api.addItem).toHaveBeenCalledWith(7,expect.objectContaining({name:"Salt",purchased:false}));
 api.items.mockResolvedValue([{name:"Salt"}]);expect(await client.missingToList("42",7)).toEqual({added:0});
});
test("new deployments continue to save inventory on the backend",async()=>{
 const {client,api}=setup();api.request.mockResolvedValue([]);await client.read();expect(client.browserOnly()).toBe(false);
 await client.save(food);expect(api.request).toHaveBeenLastCalledWith("/fridge",{method:"POST",body:food});
});
test("unavailable storage reports failed saves instead of claiming success",async()=>{
 const {client}=setup();await client.read();const spy=jest.spyOn(Storage.prototype,"setItem").mockImplementation(()=>{throw new Error("blocked");});
 await expect(client.save(food)).rejects.toThrow("could not save");spy.mockRestore();
});
