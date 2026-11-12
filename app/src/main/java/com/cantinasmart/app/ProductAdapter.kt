package com.cantinasmart.app

import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.Button
import android.widget.TextView
import androidx.recyclerview.widget.RecyclerView

class ProductAdapter(
    private val products: List<Product>,
    private val isStockMode: Boolean,
    private val cart: Map<Long, Int>,
    private val onCartChange: (Product, Int) -> Unit,
    private val onStockDelta: (Product, Int) -> Unit,
    private val onEditProduct: (Product) -> Unit
) : RecyclerView.Adapter<ProductAdapter.ViewHolder>() {

    class ViewHolder(view: View) : RecyclerView.ViewHolder(view) {
        val tvName: TextView = view.findViewById(R.id.tvItemName)
        val tvCategory: TextView = view.findViewById(R.id.tvItemCategory)
        val tvPrice: TextView = view.findViewById(R.id.tvItemPrice)
        val tvQty: TextView = view.findViewById(R.id.tvItemQty)
        val btnMinus: Button = view.findViewById(R.id.btnMinus)
        val btnPlus: Button = view.findViewById(R.id.btnPlus)
        val btnEdit: Button = view.findViewById(R.id.btnEditItem)
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ViewHolder {
        val v = LayoutInflater.from(parent.context).inflate(R.layout.item_product, parent, false)
        return ViewHolder(v)
    }

    override fun getItemCount(): Int = products.size

    override fun onBindViewHolder(holder: ViewHolder, position: Int) {
        val item = products[position]
        holder.tvName.text = item.name
        holder.tvCategory.text = "${item.category} • Disp: ${item.stock}"
        holder.tvPrice.text = "R$ %.2f".format(item.price)

        if (isStockMode) {
            holder.tvQty.text = item.stock.toString()
            holder.btnEdit.visibility = View.VISIBLE
            holder.btnMinus.setOnClickListener { onStockDelta(item, -1) }
            holder.btnPlus.setOnClickListener { onStockDelta(item, 1) }
            holder.btnEdit.setOnClickListener { onEditProduct(item) }
        } else {
            val inCart = cart[item.id] ?: 0
            holder.tvQty.text = inCart.toString()
            holder.btnEdit.visibility = View.GONE
            holder.btnMinus.isEnabled = inCart > 0
            holder.btnPlus.isEnabled = item.stock > inCart
            holder.btnMinus.setOnClickListener { onCartChange(item, -1) }
            holder.btnPlus.setOnClickListener { onCartChange(item, 1) }
        }
    }
}
