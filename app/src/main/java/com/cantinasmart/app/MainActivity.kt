package com.cantinasmart.app

import android.app.AlertDialog
import android.content.Intent
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.widget.*
import androidx.appcompat.app.AppCompatActivity
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView

class MainActivity : AppCompatActivity() {

    private lateinit var storage: StorageManager
    private lateinit var currentUser: User
    private var products = mutableListOf<Product>()
    private val cart = mutableMapOf<Long, Int>()
    private var isStockTabActive = false

    private lateinit var recyclerView: RecyclerView
    private lateinit var btnTabMenu: Button
    private lateinit var btnTabStock: Button
    private lateinit var btnAddProduct: Button
    private lateinit var cartBar: LinearLayout
    private lateinit var tvCartSummary: TextView

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        storage = StorageManager(this)

        val user = storage.getCurrentUser()
        if (user == null) {
            startActivity(Intent(this, AuthActivity::class.java))
            finish()
            return
        }
        currentUser = user
        setContentView(R.layout.activity_main)

        products = storage.getProducts()

        findViewById<TextView>(R.id.tvUserHeader).text = "${currentUser.name} (${currentUser.role.label})"
        recyclerView = findViewById(R.id.recyclerProducts)
        recyclerView.layoutManager = LinearLayoutManager(this)

        btnTabMenu = findViewById(R.id.btnTabMenu)
        btnTabStock = findViewById(R.id.btnTabStock)
        btnAddProduct = findViewById(R.id.btnAddProduct)
        cartBar = findViewById(R.id.cartBar)
        tvCartSummary = findViewById(R.id.tvCartSummary)

        // Controle de Acesso (RBAC): Aluno e Funcionário NÃO veem a aba de Estoque
        if (currentUser.role.canAccessStock()) {
            btnTabStock.visibility = View.VISIBLE
        } else {
            btnTabStock.visibility = View.GONE
        }

        btnTabMenu.setOnClickListener {
            isStockTabActive = false
            refreshUI()
        }

        btnTabStock.setOnClickListener {
            if (!currentUser.role.canAccessStock()) {
                Toast.makeText(this, "Acesso restrito a Proprietário e Administrador.", Toast.LENGTH_SHORT).show()
                return@setOnClickListener
            }
            isStockTabActive = true
            refreshUI()
        }

        btnAddProduct.setOnClickListener {
            showProductDialog(null)
        }

        findViewById<Button>(R.id.btnCheckout).setOnClickListener {
            checkoutOrder()
        }

        findViewById<Button>(R.id.btnLogout).setOnClickListener {
            storage.setCurrentUser(null)
            startActivity(Intent(this, AuthActivity::class.java))
            finish()
        }

        refreshUI()
    }

    private fun refreshUI() {
        btnAddProduct.visibility = if (isStockTabActive && currentUser.role.canAccessStock()) View.VISIBLE else View.GONE
        btnTabMenu.alpha = if (!isStockTabActive) 1.0f else 0.5f
        btnTabStock.alpha = if (isStockTabActive) 1.0f else 0.5f

        recyclerView.adapter = ProductAdapter(
            products = products,
            isStockMode = isStockTabActive,
            cart = cart,
            onCartChange = { product, delta ->
                val currentQty = cart[product.id] ?: 0
                val nextQty = currentQty + delta
                if (nextQty in 0..product.stock) {
                    if (nextQty == 0) cart.remove(product.id) else cart[product.id] = nextQty
                    refreshUI()
                } else if (nextQty > product.stock) {
                    Toast.makeText(this, "Limite em estoque: ${product.stock}", Toast.LENGTH_SHORT).show()
                }
            },
            onStockDelta = { product, delta ->
                product.stock = maxOf(0, product.stock + delta)
                storage.saveProducts(products)
                refreshUI()
            },
            onEditProduct = { product ->
                showProductDialog(product)
            }
        )

        updateCartBar()
    }

    private fun updateCartBar() {
        if (isStockTabActive || cart.isEmpty()) {
            cartBar.visibility = View.GONE
            return
        }
        var totalItems = 0
        var totalPrice = 0.0
        for ((id, qty) in cart) {
            val p = products.find { it.id == id }
            if (p != null) {
                totalItems += qty
                totalPrice += p.price * qty
            }
        }
        cartBar.visibility = View.VISIBLE
        tvCartSummary.text = "$totalItems item(ns) • Total: R$ %.2f".format(totalPrice)
    }

    private fun checkoutOrder() {
        for ((id, qty) in cart) {
            val p = products.find { it.id == id }
            if (p != null) {
                p.stock = maxOf(0, p.stock - qty)
            }
        }
        storage.saveProducts(products)
        cart.clear()
        Toast.makeText(this, "Pedido finalizado! Estoque atualizado.", Toast.LENGTH_LONG).show()
        refreshUI()
    }

    private fun showProductDialog(existing: Product?) {
        if (!currentUser.role.canAccessStock()) return

        val view = LayoutInflater.from(this).inflate(R.layout.dialog_product, null)
        val etName = view.findViewById<EditText>(R.id.etProdName)
        val etCategory = view.findViewById<EditText>(R.id.etProdCategory)
        val etPrice = view.findViewById<EditText>(R.id.etProdPrice)
        val etStock = view.findViewById<EditText>(R.id.etProdStock)

        if (existing != null) {
            etName.setText(existing.name)
            etCategory.setText(existing.category)
            etPrice.setText(existing.price.toString())
            etStock.setText(existing.stock.toString())
        }

        AlertDialog.Builder(this)
            .setTitle(if (existing == null) "Novo Produto no Estoque" else "Editar Produto")
            .setView(view)
            .setPositiveButton("Salvar") { _, _ ->
                val name = etName.text.toString().trim()
                val category = etCategory.text.toString().trim().ifEmpty { "Geral" }
                val price = etPrice.text.toString().toDoubleOrNull() ?: 0.0
                val stock = etStock.text.toString().toIntOrNull() ?: 0

                if (name.isNotEmpty() && price > 0) {
                    if (existing != null) {
                        existing.name = name
                        existing.category = category
                        existing.price = price
                        existing.stock = stock
                    } else {
                        products.add(Product(System.currentTimeMillis(), name, category, price, stock))
                    }
                    storage.saveProducts(products)
                    refreshUI()
                }
            }
            .setNegativeButton("Cancelar", null)
            .show()
    }
}
