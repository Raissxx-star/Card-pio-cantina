package com.cantinasmart.app

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject

class StorageManager(context: Context) {

    private val prefs = context.getSharedPreferences("cantina_smart_prefs", Context.MODE_PRIVATE)

    init {
        if (!prefs.contains("users")) {
            val defaultUsers = listOf(
                User("Lucas Aluno", "aluno@cantina.com", "123", UserRole.ALUNO),
                User("Mariana Funcionária", "func@cantina.com", "123", UserRole.FUNCIONARIO),
                User("Carlos Proprietário", "dono@cantina.com", "123", UserRole.PROPRIETARIO),
                User("Admin Sistema", "admin@cantina.com", "123", UserRole.ADMINISTRADOR)
            )
            saveUsers(defaultUsers)
        }
        if (!prefs.contains("products")) {
            val defaultProducts = listOf(
                Product(1L, "Coxinha de Frango", "Salgados", 6.50, 18),
                Product(2L, "Pão de Queijo", "Salgados", 4.00, 25),
                Product(3L, "Enroladinho Presunto e Queijo", "Salgados", 6.00, 4),
                Product(4L, "Suco Natural de Laranja", "Bebidas", 5.50, 15),
                Product(5L, "Refrigerante Lata", "Bebidas", 5.00, 30),
                Product(6L, "Brigadeiro Gourmet", "Doces", 3.50, 12)
            )
            saveProducts(defaultProducts)
        }
    }

    fun getUsers(): MutableList<User> {
        val list = mutableListOf<User>()
        val raw = prefs.getString("users", "[]") ?: "[]"
        val arr = JSONArray(raw)
        for (i in 0 until arr.length()) {
            val obj = arr.getJSONObject(i)
            list.add(
                User(
                    name = obj.getString("name"),
                    email = obj.getString("email"),
                    password = obj.getString("password"),
                    role = UserRole.valueOf(obj.getString("role"))
                )
            )
        }
        return list
    }

    fun saveUsers(users: List<User>) {
        val arr = JSONArray()
        users.forEach { u ->
            val obj = JSONObject()
            obj.put("name", u.name)
            obj.put("email", u.email)
            obj.put("password", u.password)
            obj.put("role", u.role.name)
            arr.put(obj)
        }
        prefs.edit().putString("users", arr.toString()).apply()
    }

    fun getProducts(): MutableList<Product> {
        val list = mutableListOf<Product>()
        val raw = prefs.getString("products", "[]") ?: "[]"
        val arr = JSONArray(raw)
        for (i in 0 until arr.length()) {
            val obj = arr.getJSONObject(i)
            list.add(
                Product(
                    id = obj.getLong("id"),
                    name = obj.getString("name"),
                    category = obj.getString("category"),
                    price = obj.getDouble("price"),
                    stock = obj.getInt("stock")
                )
            )
        }
        return list
    }

    fun saveProducts(products: List<Product>) {
        val arr = JSONArray()
        products.forEach { p ->
            val obj = JSONObject()
            obj.put("id", p.id)
            obj.put("name", p.name)
            obj.put("category", p.category)
            obj.put("price", p.price)
            obj.put("stock", p.stock)
            arr.put(obj)
        }
        prefs.edit().putString("products", arr.toString()).apply()
    }

    fun setCurrentUser(user: User?) {
        if (user == null) {
            prefs.edit().remove("current_user_email").apply()
        } else {
            prefs.edit().putString("current_user_email", user.email).apply()
        }
    }

    fun getCurrentUser(): User? {
        val email = prefs.getString("current_user_email", null) ?: return null
        return getUsers().find { it.email == email }
    }
}
