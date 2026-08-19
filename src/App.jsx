import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import { Users, UserPlus, CreditCard, Search, Check, AlertCircle, CheckCircle, Edit, Trash2, X, MessageCircle, Lock, LogOut } from 'lucide-react'

export default function App() {
  // Estado para controlar la vista principal de la v2.0 ('seleccion', 'login', 'admin')
  const [modo, setModo] = useState('seleccion')

  // Credenciales simples para el entrenador
  const [usuario, setUsuario] = useState('')
  const [password, setPassword] = useState('')
  const [errorLogin, setErrorLogin] = useState('')

  // --- ESTADOS ORIGINALES DE TU APP 1.0 ---
  const [pestana, setPestana] = useState('alumnos')
  const [alumnos, setAlumnos] = useState([])
  const [loading, setLoading] = useState(true)
  const [filtroCategoria, setFiltroCategoria] = useState('todos')

  // Formulario Nuevo / Edición Alumno
  const [nombre, setNombre] = useState('')
  const [telefono, setTelefono] = useState('')
  const [categoria, setCategoria] = useState('recreativo')
  const [alumnoEditando, setAlumnoEditando] = useState(null)
  const [mensaje, setMensaje] = useState('')

  // Formulario Nuevo Pago con Buscador
  const [busquedaAlumno, setBusquedaAlumno] = useState('')
  const [alumnoSeleccionado, setAlumnoSeleccionado] = useState(null)
  const [monto, setMonto] = useState('')

  useEffect(() => {
    cargarAlumnos()
  }, [])

  const cargarAlumnos = async () => {
    setLoading(true)
    
    const { data, error } = await supabase
      .from('alumnos')
      .select(`
        *,
        pagos (
          proximo_pago
        )
      `)

    if (!error && data) {
      const hoy = new Date().toISOString().split('T')[0]
      
      const alumnosProcesados = data.map((alumno) => {
        let proximoPago = null
        let estaActivo = false

        if (alumno.pagos && alumno.pagos.length > 0) {
          const fechas = alumno.pagos
            .map(p => p.proximo_pago)
            .filter(Boolean)
            .sort()
            .reverse()

          if (fechas.length > 0) {
            proximoPago = fechas[0]
            estaActivo = proximoPago >= hoy
          }
        }

        return {
          ...alumno,
          proximoPago,
          estaActivo
        }
      })

      setAlumnos(alumnosProcesados)
    }
    setLoading(false)
  }

  // Login sencillo para el Entrenador
  const manejarLogin = (e) => {
    e.preventDefault()
    // Aquí puedes cambiar el usuario y contraseña si lo deseas
    if (usuario === 'admin' && password === '1234') {
      setModo('admin')
      setErrorLogin('')
      setUsuario('')
      setPassword('')
    } else {
      setErrorLogin('Usuario o contraseña incorrectos')
    }
  }

  const guardarAlumno = async (e) => {
    e.preventDefault()
    setMensaje('')

    if (alumnoEditando) {
      const { error } = await supabase
        .from('alumnos')
        .update({ nombre, telefono, tipo_alumno: categoria })
        .eq('id', alumnoEditando.id)

      if (error) {
        setMensaje('Error al actualizar: ' + error.message)
      } else {
        setMensaje('¡Alumno actualizado correctamente!')
        cancelarEdicion()
        cargarAlumnos()
      }
    } else {
      const { error } = await supabase
        .from('alumnos')
        .insert([{ nombre, telefono, tipo_alumno: categoria }])
      
      if (error) {
        setMensaje('Error: ' + error.message)
      } else {
        setMensaje('¡Alumno registrado con éxito!')
        setNombre('')
        setTelefono('')
        cargarAlumnos()
      }
    }
  }

  const iniciarEdicion = (alumno) => {
    setAlumnoEditando(alumno)
    setNombre(alumno.nombre)
    setTelefono(alumno.telefono)
    setCategoria(alumno.tipo_alumno || 'recreativo')
    setPestana('nuevo')
  }

  const cancelarEdicion = () => {
    setAlumnoEditando(null)
    setNombre('')
    setTelefono('')
    setCategoria('recreativo')
  }

  const eliminarAlumno = async (id, nombreAlumno) => {
    const confirmar = window.confirm(`¿Estás seguro de que deseas eliminar a ${nombreAlumno}? También se borrarán sus pagos registrados.`)
    if (!confirmar) return

    setMensaje('')
    
    await supabase.from('pagos').delete().eq('alumno_id', id)
    const { error } = await supabase.from('alumnos').delete().eq('id', id)

    if (error) {
      setMensaje('Error al eliminar: ' + error.message)
    } else {
      setMensaje(`Alumno ${nombreAlumno} eliminado con éxito.`)
      cargarAlumnos()
    }
  }

  const registrarPago = async (e) => {
    e.preventDefault()
    setMensaje('')
    
    if (!alumnoSeleccionado) {
      setMensaje('Debes seleccionar un alumno de la lista.')
      return
    }

    const hoy = new Date()
    const proximoPago = new Date()
    proximoPago.setMonth(hoy.getMonth() + 1)

    const { error } = await supabase.from('pagos').insert([{
      alumno_id: alumnoSeleccionado.id,
      monto: parseFloat(monto),
      proximo_pago: proximoPago.toISOString().split('T')[0]
    }])

    if (error) {
      setMensaje('Error al registrar pago: ' + error.message)
    } else {
      setMensaje(`¡Pago registrado correctamente para ${alumnoSeleccionado.nombre}!`)
      setMonto('')
      setAlumnoSeleccionado(null)
      setBusquedaAlumno('')
      cargarAlumnos()
    }
  }

  const enviarRecordatorioWhatsApp = (alumno) => {
    const textoMensaje = `Hola ${alumno.nombre}, te recordamos que tu mensualidad de boxeo venció el día ${alumno.proximoPago}. Por favor acércate a la recepción para realizar tu pago. ¡Gracias!`
    const telefonoLimpio = alumno.telefono.replace(/[^0-9]/g, '')
    const url = `https://wa.me/${telefonoLimpio}?text=${encodeURIComponent(textoMensaje)}`
    window.open(url, '_blank')
  }

  const alumnosFiltrados = alumnos.filter((alumno) => {
    if (filtroCategoria === 'todos') return true
    return alumno.tipo_alumno?.toLowerCase() === filtroCategoria
  })

  const sugerenciasAlumnos = busquedaAlumno.trim() === '' 
    ? [] 
    : alumnos.filter(a => a.nombre.toLowerCase().includes(busquedaAlumno.toLowerCase()))

  // --- VISTA 1: PANTALLA SPLIT (ENTRENADOR Y ALUMNO) ---
  if (modo === 'seleccion') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', width: '100vw', backgroundColor: '#000', fontFamily: 'system-ui, sans-serif' }}>
        {/* Bloque Entrenador */}
        <div 
          onClick={() => setModo('login')}
          style={{
            flex: 1,
            backgroundImage: `linear-gradient(rgba(0, 0, 0, 0.6), rgba(0, 0, 0, 0.8)), url('/alumno.jpg')`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            cursor: 'pointer',
            borderBottom: '2px solid #333'
          }}
        >
          <h2 style={{ fontSize: '32px', color: '#fff', textTransform: 'uppercase', letterSpacing: '2px', margin: 0 }}>Entrenador</h2>
          <p style={{ color: '#aaa', fontSize: '14px', marginTop: '5px' }}>Gestionar cobros y alumnos</p>
        </div>

        {/* Bloque Alumno */}
        <div 
          onClick={() => alert('Acceso de Alumno seleccionado')}
          style={{
            flex: 1,
            backgroundImage: `linear-gradient(rgba(0, 0, 0, 0.6), rgba(0, 0, 080', 0.8)), url('/alumno.jpg')`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            cursor: 'pointer'
          }}
        >
          <h2 style={{ fontSize: '32px', color: '#fff', textTransform: 'uppercase', letterSpacing: '2px', margin: 0 }}>Alumno</h2>
          <p style={{ color: '#aaa', fontSize: '14px', marginTop: '5px' }}>Consultar estatus</p>
        </div>
      </div>
    )
  }

  // --- VISTA 2: FORMULARIO DE LOGIN ENTRENADOR ---
  if (modo === 'login') {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#111827',
        fontFamily: 'system-ui, sans-serif',
        padding: '20px'
      }}>
        <form onSubmit={manejarLogin} style={{
          backgroundColor: '#1f2937',
          padding: '30px',
          borderRadius: '12px',
          width: '100%',
          maxWidth: '360px',
          boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
          color: '#fff'
        }}>
          <div style={{ textAlign: 'center', marginBottom: '20px' }}>
            <Lock size={40} color="#3b82f6" style={{ marginBottom: '10px' }} />
            <h2 style={{ margin: 0 }}>Acceso Entrenador</h2>
            <p style={{ fontSize: '12px', color: '#9ca3af' }}>Ingresa tus credenciales</p>
          </div>

          {errorLogin && (
            <div style={{ backgroundColor: '#7f1d1d', color: '#fca5a5', padding: '8px', borderRadius: '6px', fontSize: '12px', marginBottom: '15px', textAlign: 'center' }}>
              {errorLogin}
            </div>
          )}

          <div style={{ marginBottom: '15px' }}>
            <label style={{ fontSize: '12px', color: '#9ca3af', display: 'block', marginBottom: '5px' }}>Usuario</label>
            <input 
              type="text" 
              value={usuario}
              onChange={(e) => setUsuario(e.target.value)}
              placeholder="Ej: admin" 
              required
              style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #374151', backgroundColor: '#111827', color: '#fff', boxSizing: 'border-box' }} 
            />
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={{ fontSize: '12px', color: '#9ca3af', display: 'block', marginBottom: '5px' }}>Contraseña</label>
            <input 
              type="password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••" 
              required
              style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #374151', backgroundColor: '#111827', color: '#fff', boxSizing: 'border-box' }} 
            />
          </div>

          <button type="submit" style={{ width: '100%', padding: '12px', backgroundColor: '#2563eb', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', marginBottom: '10px' }}>
            Ingresar
          </button>

          <button type="button" onClick={() => setModo('seleccion')} style={{ width: '100%', padding: '10px', backgroundColor: 'transparent', color: '#9ca3af', border: 'none', cursor: 'pointer', fontSize: '12px' }}>
            Volver atrás
          </button>
        </form>
      </div>
    )
  }

  // --- VISTA 3: TU APP 1.0 ORIGINAL (MODO ADMIN) ---
  return (
    <div style={{
      minHeight: '100vh',
      width: '100%',
      backgroundImage: `linear-gradient(rgba(0, 0, 0, 0.8), rgba(0, 0, 0, 0.9)), url('/fondo.jpg')`,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      backgroundRepeat: 'no-repeat',
      backgroundAttachment: 'fixed',
      fontFamily: 'system-ui, sans-serif',
      color: '#fff'
    }}>
      <div style={{ maxWidth: '480px', margin: '0 auto', padding: '15px' }}>
        
        {/* Encabezado con Botón Salir */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
          <div>
            <h1 style={{ fontSize: '20px', margin: 0 }}>🥊 Academia de Boxeo</h1>
            <p style={{ color: '#aaa', fontSize: '12px', margin: 0 }}>Panel Entrenador</p>
          </div>
          <button 
            onClick={() => setModo('seleccion')}
            style={{ backgroundColor: '#334155', color: '#fff', border: 'none', padding: '6px 10px', borderRadius: '6px', fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' }}
          >
            <LogOut size={14} /> Salir
          </button>
        </div>

        {/* Navegación por Pestañas */}
        <div style={{ display: 'flex', gap: '5px', backgroundColor: 'rgba(30, 30, 30, 0.85)', padding: '5px', borderRadius: '10px', marginBottom: '20px', backdropFilter: 'blur(5px)' }}>
          <button 
            onClick={() => { setPestana('alumnos'); setMensaje(''); }}
            style={{ flex: 1, padding: '10px', border: 'none', borderRadius: '8px', background: pestana === 'alumnos' ? '#2563eb' : 'transparent', color: '#fff', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px' }}>
            <Users size={16} /> Alumnos
          </button>
          <button 
            onClick={() => { setPestana('nuevo'); setMensaje(''); }}
            style={{ flex: 1, padding: '10px', border: 'none', borderRadius: '8px', background: pestana === 'nuevo' ? '#2563eb' : 'transparent', color: '#fff', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px' }}>
            <UserPlus size={16} /> {alumnoEditando ? 'Editar' : 'Nuevo'}
          </button>
          <button 
            onClick={() => { setPestana('pagos'); setMensaje(''); }}
            style={{ flex: 1, padding: '10px', border: 'none', borderRadius: '8px', background: pestana === 'pagos' ? '#2563eb' : 'transparent', color: '#fff', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px' }}>
            <CreditCard size={16} /> Cobrar
          </button>
        </div>

        {mensaje && (
          <div style={{ backgroundColor: '#1e293b', borderLeft: '4px solid #3b82f6', padding: '10px', borderRadius: '5px', marginBottom: '15px', fontSize: '14px' }}>
            {mensaje}
          </div>
        )}

        {/* Vista: Lista de Alumnos */}
        {pestana === 'alumnos' && (
          <div>
            <h3 style={{ marginBottom: '10px' }}>Lista de Inscritos ({alumnosFiltrados.length})</h3>

            {/* Botones de Filtro */}
            <div style={{ display: 'flex', gap: '5px', marginBottom: '15px', flexWrap: 'wrap' }}>
              {[
                { id: 'todos', label: 'Todos' },
                { id: 'niños', label: 'Niños' },
                { id: 'recreativo', label: 'Recreativo' },
                { id: 'competitivo', label: 'Competitivo' }
              ].map((f) => (
                <button
                  key={f.id}
                  onClick={() => setFiltroCategoria(f.id)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '20px',
                    border: 'none',
                    fontSize: '12px',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    backgroundColor: filtroCategoria === f.id ? '#2563eb' : '#334155',
                    color: '#fff'
                  }}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {loading ? (
              <p style={{ color: '#aaa' }}>Cargando alumnos...</p>
            ) : alumnosFiltrados.length === 0 ? (
              <p style={{ color: '#aaa' }}>No hay alumnos en esta categoría.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {alumnosFiltrados.map((alumno) => (
                  <div key={alumno.id} style={{ backgroundColor: 'rgba(30, 30, 30, 0.85)', padding: '15px', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backdropFilter: 'blur(5px)' }}>
                    <div>
                      <strong style={{ fontSize: '16px', display: 'block' }}>{alumno.nombre}</strong>
                      <span style={{ fontSize: '12px', color: '#aaa', display: 'block' }}>📱 {alumno.telefono}</span>
                      <span style={{ fontSize: '12px', color: '#888', marginTop: '2px', display: 'block' }}>
                        📅 Vence: {alumno.proximoPago ? alumno.proximoPago : 'Sin pagos'}
                      </span>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px' }}>
                      <span style={{ backgroundColor: '#334155', padding: '4px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold', textTransform: 'capitalize' }}>
                        {alumno.tipo_alumno}
                      </span>
                      
                      {alumno.proximoPago ? (
                        alumno.estaActivo ? (
                          <span style={{ backgroundColor: '#15803d', color: '#fff', padding: '3px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <CheckCircle size={12} /> Al día
                          </span>
                        ) : (
                          <span style={{ backgroundColor: '#b91c1c', color: '#fff', padding: '3px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <AlertCircle size={12} /> Vencido
                          </span>
                        )
                      ) : (
                        <span style={{ backgroundColor: '#475569', color: '#aaa', padding: '3px 8px', borderRadius: '12px', fontSize: '11px' }}>
                          Pendiente
                        </span>
                      )}

                      {/* Botones de Acción */}
                      <div style={{ display: 'flex', gap: '6px', marginTop: '4px' }}>
                        {!alumno.estaActivo && alumno.proximoPago && (
                          <button 
                            onClick={() => enviarRecordatorioWhatsApp(alumno)}
                            title="Enviar Cobro por WhatsApp"
                            style={{ backgroundColor: '#16a34a', border: 'none', borderRadius: '4px', padding: '5px', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                          >
                            <MessageCircle size={14} />
                          </button>
                        )}
                        <button 
                          onClick={() => iniciarEdicion(alumno)}
                          title="Editar alumno"
                          style={{ backgroundColor: '#3b82f6', border: 'none', borderRadius: '4px', padding: '5px', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                        >
                          <Edit size={14} />
                        </button>
                        <button 
                          onClick={() => eliminarAlumno(alumno.id, alumno.nombre)}
                          title="Eliminar alumno"
                          style={{ backgroundColor: '#ef4444', border: 'none', borderRadius: '4px', padding: '5px', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Vista: Registrar / Editar Alumno */}
        {pestana === 'nuevo' && (
          <form onSubmit={guardarAlumno} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3>{alumnoEditando ? 'Editar Alumno' : 'Nuevo Alumno'}</h3>
              {alumnoEditando && (
                <button 
                  type="button" 
                  onClick={cancelarEdicion}
                  style={{ backgroundColor: '#334155', color: '#fff', border: 'none', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}
                >
                  <X size={14} /> Cancelar
                </button>
              )}
            </div>

            <input
              type="text"
              placeholder="Nombre Completo"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              required
              style={{ padding: '12px', borderRadius: '6px', border: '1px solid #333', backgroundColor: 'rgba(30, 30, 30, 0.9)', color: '#fff' }}
            />
            <input
              type="tel"
              placeholder="Teléfono (WhatsApp Ej: 5211234567890)"
              value={telefono}
              onChange={(e) => setTelefono(e.target.value)}
              required
              style={{ padding: '12px', borderRadius: '6px', border: '1px solid #333', backgroundColor: 'rgba(30, 30, 30, 0.9)', color: '#fff' }}
            />
            <select
              value={categoria}
              onChange={(e) => setCategoria(e.target.value)}
              style={{ padding: '12px', borderRadius: '6px', border: '1px solid #333', backgroundColor: 'rgba(30, 30, 30, 0.9)', color: '#fff' }}
            >
              <option value="niños">Niños</option>
              <option value="recreativo">Recreativo</option>
              <option value="competitivo">Competitivo</option>
            </select>
            <button type="submit" style={{ padding: '12px', backgroundColor: alumnoEditando ? '#2563eb' : '#16a34a', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', marginTop: '10px' }}>
              {alumnoEditando ? 'Guardar Cambios' : 'Guardar e Inscribir'}
            </button>
          </form>
        )}

        {/* Vista: Registrar Pago */}
        {pestana === 'pagos' && (
          <form onSubmit={registrarPago} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <h3>Registrar Mensualidad</h3>

            <div style={{ position: 'relative' }}>
              <label style={{ fontSize: '12px', color: '#aaa', marginBottom: '4px', display: 'block' }}>
                Buscar Alumno por Nombre:
              </label>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <input
                  type="text"
                  placeholder="Escribe el nombre del alumno..."
                  value={busquedaAlumno}
                  onChange={(e) => {
                    setBusquedaAlumno(e.target.value)
                    setAlumnoSeleccionado(null)
                  }}
                  style={{
                    width: '100%',
                    padding: '12px 12px 12px 35px',
                    borderRadius: '6px',
                    border: '1px solid #333',
                    backgroundColor: 'rgba(30, 30, 30, 0.9)',
                    color: '#fff',
                    boxSizing: 'border-box'
                  }}
                />
                <Search size={18} style={{ position: 'absolute', left: '10px', color: '#888' }} />
              </div>

              {!alumnoSeleccionado && sugerenciasAlumnos.length > 0 && (
                <div style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  right: 0,
                  backgroundColor: '#2a2a2a',
                  border: '1px solid #444',
                  borderRadius: '0 0 6px 6px',
                  maxHeight: '150px',
                  overflowY: 'auto',
                  zIndex: 10,
                  boxShadow: '0 4px 10px rgba(0,0,0,0.5)'
                }}>
                  {sugerenciasAlumnos.map((a) => (
                    <div
                      key={a.id}
                      onClick={() => {
                        setAlumnoSeleccionado(a)
                        setBusquedaAlumno(a.nombre)
                      }}
                      style={{
                        padding: '10px 12px',
                        cursor: 'pointer',
                        borderBottom: '1px solid #333',
                        display: 'flex',
                        justify: 'space-between',
                        alignItems: 'center'
                      }}
                    >
                      <span>{a.nombre}</span>
                      <span style={{ fontSize: '11px', color: '#aaa' }}>{a.tipo_alumno}</span>
                    </div>
                  ))}
                </div>
              )}

              {alumnoSeleccionado && (
                <div style={{ marginTop: '6px', fontSize: '12px', color: '#22c55e', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Check size={14} /> Seleccionado: <strong>{alumnoSeleccionado.nombre}</strong>
                </div>
              )}
            </div>

            <input
              type="number"
              placeholder="Monto ($)"
              value={monto}
              onChange={(e) => setMonto(e.target.value)}
              required
              style={{ padding: '12px', borderRadius: '6px', border: '1px solid #333', backgroundColor: 'rgba(30, 30, 30, 0.9)', color: '#fff' }}
            />
            
            <button 
              type="submit" 
              disabled={!alumnoSeleccionado}
              style={{ 
                padding: '12px', 
                backgroundColor: alumnoSeleccionado ? '#2563eb' : '#475569', 
                color: '#fff', 
                border: 'none', 
                borderRadius: '6px', 
                fontWeight: 'bold', 
                cursor: alumnoSeleccionado ? 'pointer' : 'not-allowed', 
                marginTop: '10px' 
              }}
            >
              Registrar Pago
            </button>
          </form>
        )}

      </div>
    </div>
  )
}