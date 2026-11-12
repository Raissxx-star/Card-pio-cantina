package com.cantinasmart.app

import android.content.Intent
import android.os.Bundle
import android.view.View
import android.widget.*
import androidx.appcompat.app.AppCompatActivity

class AuthActivity : AppCompatActivity() {

    private lateinit var storage: StorageManager
    private var isRegisterMode = false

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        storage = StorageManager(this)

        // Se já estiver logado, vai direto para o sistema
        if (storage.getCurrentUser() != null) {
            startActivity(Intent(this, MainActivity::class.java))
            finish()
            return
        }

        setContentView(R.layout.activity_auth)

        val tabLogin = findViewById<Button>(R.id.btnTabLogin)
        val tabRegister = findViewById<Button>(R.id.btnTabRegister)
        val layoutName = findViewById<LinearLayout>(R.id.layoutName)
        val layoutRole = findViewById<LinearLayout>(R.id.layoutRole)
        val spinnerRole = findViewById<Spinner>(R.id.spinnerRole)
        val tvRoleHint = findViewById<TextView>(R.id.tvRoleHint)
        val btnSubmit = findViewById<Button>(R.id.btnSubmitAuth)

        val roles = UserRole.values().map { it.label }
        spinnerRole.adapter = ArrayAdapter(this, android.R.layout.simple_spinner_dropdown_item, roles)

        spinnerRole.onItemSelectedListener = object : AdapterView.OnItemSelectedListener {
            override fun onItemSelected(parent: AdapterView<*>?, view: View?, position: Int, id: Long) {
                val role = UserRole.values()[position]
                tvRoleHint.text = if (role.canAccessStock()) {
                    "Permissão: Cardápio + Controle de Estoque"
                } else {
                    "Permissão: Somente acesso ao Cardápio"
                }
            }
            override fun onNothingSelected(parent: AdapterView<*>?) {}
        }

        fun updateMode() {
            layoutName.visibility = if (isRegisterMode) View.VISIBLE else View.GONE
            layoutRole.visibility = if (isRegisterMode) View.VISIBLE else View.GONE
            btnSubmit.text = if (isRegisterMode) "Concluir Cadastro" else "Entrar no Sistema"
            tabLogin.alpha = if (!isRegisterMode) 1.0f else 0.5f
            tabRegister.alpha = if (isRegisterMode) 1.0f else 0.5f
        }

        tabLogin.setOnClickListener {
            isRegisterMode = false
            updateMode()
        }

        tabRegister.setOnClickListener {
            isRegisterMode = true
            updateMode()
        }

        updateMode()

        btnSubmit.setOnClickListener {
            val email = findViewById<EditText>(R.id.etEmail).text.toString().trim().lowercase()
            val password = findViewById<EditText>(R.id.etPassword).text.toString()

            if (email.isEmpty() || password.isEmpty()) {
                Toast.makeText(this, "Preencha todos os campos obrigatórios.", Toast.LENGTH_SHORT).show()
                return@setOnClickListener
            }

            val users = storage.getUsers()

            if (isRegisterMode) {
                val name = findViewById<EditText>(R.id.etName).text.toString().trim()
                if (name.isEmpty()) {
                    Toast.makeText(this, "Informe seu nome completo.", Toast.LENGTH_SHORT).show()
                    return@setOnClickListener
                }
                if (users.any { it.email == email }) {
                    Toast.makeText(this, "Este e-mail ou matrícula já está cadastrado.", Toast.LENGTH_SHORT).show()
                    return@setOnClickListener
                }
                val selectedRole = UserRole.values()[spinnerRole.selectedItemPosition]
                val newUser = User(name, email, password, selectedRole)
                users.add(newUser)
                storage.saveUsers(users)
                loginSuccess(newUser)
            } else {
                val found = users.find { it.email == email && it.password == password }
                if (found == null) {
                    Toast.makeText(this, "E-mail ou senha inválidos.", Toast.LENGTH_SHORT).show()
                } else {
                    loginSuccess(found)
                }
            }
        }
    }

    private fun loginSuccess(user: User) {
        storage.setCurrentUser(user)
        startActivity(Intent(this, MainActivity::class.java))
        finish()
    }
}
