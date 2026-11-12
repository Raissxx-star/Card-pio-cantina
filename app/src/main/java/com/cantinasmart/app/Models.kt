package com.cantinasmart.app

enum class UserRole(val label: String) {
    ALUNO("Aluno"),
    FUNCIONARIO("Funcionário"),
    PROPRIETARIO("Proprietário"),
    ADMINISTRADOR("Administrador");

    fun canAccessStock(): Boolean {
        return this == PROPRIETARIO || this == ADMINISTRADOR
    }
}

data class User(
    val name: String,
    val email: String,
    val password: String,
    val role: UserRole
)

data class Product(
    val id: Long,
    var name: String,
    var category: String,
    var price: Double,
    var stock: Int
)
